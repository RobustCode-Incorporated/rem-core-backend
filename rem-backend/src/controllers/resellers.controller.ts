import { Request, Response } from 'express';
import { db } from '../config/db';
import bcrypt from 'bcrypt';

/**
 * @desc    Création transactionnelle d'un revendeur et de ses accès
 */
export const createResellerWithAccess = async (req: Request, res: Response): Promise<void> => {
  const { firstName, lastName, email, password, phone, deposit_name, company_id } = req.body;

  if (!firstName || !lastName || !email || !password || !company_id) {
    res.status(400).json({ success: false, message: "Champs obligatoires manquants." });
    return;
  }

  try {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    await db.query('BEGIN');

    const userQuery = `
      INSERT INTO public.users (company_id, first_name, last_name, email, password_hash, role, is_active)
      VALUES ($1, $2, $3, $4, $5, 'STAFF', true)
      RETURNING id;
    `;
    const userRes = await db.query(userQuery, [company_id, firstName, lastName, email, passwordHash]);
    const userId = userRes.rows[0].id;

    const resellerQuery = `
      INSERT INTO public.resellers (id, company_id, name, email, phone, deposit_name, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id;
    `;
    const fullName = `${firstName} ${lastName}`;
    await db.query(resellerQuery, [userId, company_id, fullName, email, phone, deposit_name, passwordHash]);

    await db.query('COMMIT');
    res.status(201).json({ success: true, message: "Revendeur créé avec succès.", userId });

  } catch (error: any) {
    await db.query('ROLLBACK');
    console.error("❌ [CONTROLLER ERROR] createResellerWithAccess :", error);
    res.status(500).json({ success: false, message: "Erreur lors de la création.", details: error.message });
  }
};

/**
 * @desc    Extraction cartographique synchrone
 */
export const getResellersLiveLocation = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req.query.company_id as string) || '943e411e-9c4c-484f-9dde-9db708f5159a';
  try {
    const result = await db.query(
      `SELECT id, name, email, phone, deposit_name, latitude, longitude 
       FROM public.resellers WHERE company_id = $1`,
      [companyId]
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: "Erreur lors de la récupération." });
  }
};

/**
 * @desc    Tableau de bord financier et opérationnel agrégé du revendeur
 */
export const getResellerPerformance = async (req: Request, res: Response): Promise<void> => {
  const resellerId = req.params.id;
  const companyId = req.query.company_id as string;
  try {
    const resellerRes = await db.query(
      `SELECT id, name, deposit_name FROM public.resellers WHERE id = $1 AND company_id = $2`,
      [resellerId, companyId]
    );

    if (resellerRes.rows.length === 0) {
      res.status(404).json({ success: false, message: "Revendeur introuvable." });
      return;
    }

    // 🛠️ CORRECTION : Suppression du filtre exclusif 'FACTURE' pour inclure les 'RESTOCK_REQUEST' 
    // et capture dynamique des états 'DRAFT' (commandes en cours)
    const financialsQuery = `
      SELECT 
        type,
        status, 
        SUM(total_amount)::float as total_revenue, 
        COUNT(id)::int as total_invoices
      FROM public.documents
      WHERE reseller_id = $1 AND company_id = $2
      GROUP BY type, status
    `;
    const financialsRes = await db.query(financialsQuery, [resellerId, companyId]);

    const topProductsQuery = `
      SELECT p.name as product_name, SUM(di.quantity)::int as units_sold
      FROM public.document_items di
      JOIN public.products p ON di.product_id = p.id
      JOIN public.documents d ON di.document_id = d.id
      WHERE d.reseller_id = $1 AND d.company_id = $2
      GROUP BY p.name ORDER BY units_sold DESC LIMIT 3
    `;
    const topProductsRes = await db.query(topProductsQuery, [resellerId, companyId]);

    res.status(200).json({
      success: true,
      reseller: resellerRes.rows[0],
      analytics: {
        financials: financialsRes.rows,
        topProducts: topProductsRes.rows
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
};

/**
 * @desc    Récupération du stock avec indicateurs pour Donuts de Stock Optimal
 * @route   GET /api/resellers/me/stock
 */
export const getMyStock = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user; 
  
  if (!user || !user.id) {
    res.status(401).json({ success: false, message: "Non autorisé." });
    return;
  }

  try {
    const query = `
      SELECT 
        rs.id,
        rs.quantity,
        rs.min_threshold,
        rs.product_id,
        p.name as product_name
      FROM public.reseller_stocks rs
      JOIN public.products p ON rs.product_id = p.id
      WHERE rs.reseller_id = $1
    `;
    
    const result = await db.query(query, [user.id]);
    
    // 🛠️ CORRECTION : Calcul et injection des données pour les donuts de stock optimal par marchandise
    const formattedData = result.rows.map(row => {
      const currentStock = row.quantity || 0;
      const minThreshold = row.min_threshold || 10;
      
      // Règle de la Software Factory : Le stock optimal est défini à 3x le seuil minimal
      const optimalThreshold = minThreshold * 3;
      
      // Calcul du pourcentage pour le Donut
      const percentage = optimalThreshold > 0 
        ? Math.min(Math.round((currentStock / optimalThreshold) * 100), 100)
        : 0;

      // Définition de la couleur/état de la marchandise
      let stockStatus = 'WARNING';
      if (currentStock <= minThreshold) {
        stockStatus = 'CRITICAL';
      } else if (currentStock >= optimalThreshold) {
        stockStatus = 'OPTIMAL';
      }

      return {
        id: row.id,
        quantity: currentStock,
        min_threshold: minThreshold,
        optimal_threshold: optimalThreshold, // 👈 Requis pour le Donut
        percentage: percentage,             // 👈 Requis pour le Donut
        stock_status: stockStatus,           // 👈 Requis pour le Donut (CRITICAL, WARNING, OPTIMAL)
        product_id: row.product_id,
        products: { 
          name: row.product_name 
        } 
      };
    });

    res.status(200).json(formattedData);
  } catch (error) {
    console.error("❌ [CONTROLLER ERROR] getMyStock :", error);
    res.status(500).json({ error: "Erreur lors du chargement de l'inventaire." });
  }
};