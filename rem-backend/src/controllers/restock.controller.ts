import { Request, Response } from 'express';
import { db } from '../config/db';
import pino from 'pino';

const logger = pino({ transport: { target: 'pino-pretty' } });

/**
 * @desc    Génère une demande de réapprovisionnement (Facture de type RESTOCK)
 * @route   POST /api/restock/request
 */
export const requestRestock = async (req: Request, res: Response): Promise<void> => {
  const { items } = req.body;
  const user = (req as any).user;
  const companyId = user?.companyId;

  if (!items || items.length === 0) {
    res.status(400).json({ success: false, error: "Aucun produit sélectionné pour le réapprovisionnement." });
    return;
  }

  try {
    await db.query('BEGIN');

    // 1. Création du document de type RESTOCK_REQUEST (Brouillon)
    const docNumber = `RESTOCK-${Date.now().toString().slice(-6)}`;
    const docQuery = `
      INSERT INTO public.documents (company_id, reseller_id, type, number, status, total_amount)
      VALUES ($1, $2, 'RESTOCK_REQUEST', $3, 'DRAFT', 0)
      RETURNING id;
    `;
    const docRes = await db.query(docQuery, [companyId, user.id, docNumber]);
    const docId = docRes.rows[0].id;

    let totalDocumentAmount = 0;

    // 2. Ajout des lignes de commande avec récupération dynamique des prix
    for (const item of items) {
      // Récupération du prix d'achat du produit
      const productRes = await db.query(
        `SELECT purchase_price FROM public.products WHERE id = $1 AND company_id = $2`,
        [item.product_id, companyId]
      );

      if (productRes.rowCount === 0) {
        throw new Error(`Produit introuvable ou non autorisé : ${item.product_id}`);
      }

      const unitPrice = productRes.rows[0].purchase_price;
      const totalPrice = unitPrice * item.quantity;
      totalDocumentAmount += totalPrice;

      // Insertion sécurisée incluant unit_price et total_price
      await db.query(
        `INSERT INTO public.document_items (document_id, product_id, quantity, unit_price, total_price) 
         VALUES ($1, $2, $3, $4, $5)`,
        [docId, item.product_id, item.quantity, unitPrice, totalPrice]
      );
    }

    // 3. Mise à jour du montant total réel sur le document parent
    await db.query(
      `UPDATE public.documents SET total_amount = $1 WHERE id = $2`,
      [totalDocumentAmount, docId]
    );

    await db.query('COMMIT');
    logger.info({ docId, resellerId: user.id }, '[REM RESTOCK] Demande créée avec succès.');

    res.status(201).json({ success: true, message: "Demande de réapprovisionnement envoyée.", docId });
  } catch (error: any) {
    await db.query('ROLLBACK');
    logger.error(error, '[REM RESTOCK ERROR]');
    res.status(500).json({ success: false, error: "Échec de la création de la demande." });
  }
};

/**
 * @desc    Validation admin : Valide le paiement et transfère le stock
 * @route   PUT /api/restock/validate/:id
 */
export const validateRestock = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    await db.query('BEGIN');

    // 1. Récupérer les informations du document, de l'entreprise et son statut actuel
    const doc = await db.query(
      `SELECT reseller_id, company_id, status FROM public.documents WHERE id = $1 AND type = 'RESTOCK_REQUEST' AND company_id = $2`, 
      [id, (req as any).user?.companyId]
    );
    
    if (doc.rowCount === 0) {
      await db.query('ROLLBACK');
      res.status(404).json({ success: false, error: "Document introuvable." });
      return;
    }

    if (doc.rows[0].status === 'PAID') {
      await db.query('ROLLBACK');
      res.status(400).json({ success: false, error: "Cette commande a déjà été validée et payée." });
      return;
    }

    const { reseller_id, company_id } = doc.rows[0];

    // 2. Récupérer les items liés à cette commande
    const items = await db.query(
      `SELECT product_id, quantity FROM public.document_items WHERE document_id = $1`, 
      [id]
    );

    // 3. Boucle de vérification et de transfert de flux de stock (Admin -> Revendeur)
    for (const item of items.rows) {
      // Vérification de la disponibilité du stock central (chez l'Admin)
      const productCheck = await db.query(
        `SELECT stock_quantity, name FROM public.products WHERE id = $1 AND company_id = $2`,
        [item.product_id, company_id]
      );

      const adminStock = productCheck.rows[0]?.stock_quantity || 0;
      const productName = productCheck.rows[0]?.name || "Produit inconnu";

      if (adminStock < item.quantity) {
        throw new Error(`Stock Admin insuffisant pour le produit : ${productName} (Disponible: ${adminStock}, Demandé: ${item.quantity})`);
      }

      // A. Déduction du stock global de l'Admin
      await db.query(
        `UPDATE public.products SET stock_quantity = stock_quantity - $1 WHERE id = $2`,
        [item.quantity, item.product_id]
      );

      // B. Attribution ou mise à jour (Upsert) du stock pour le Revendeur
      await db.query(`
        INSERT INTO public.reseller_stocks (reseller_id, product_id, quantity)
        VALUES ($1, $2, $3)
        ON CONFLICT (reseller_id, product_id) 
        DO UPDATE SET quantity = public.reseller_stocks.quantity + EXCLUDED.quantity
      `, [reseller_id, item.product_id, item.quantity]);
    }

    // 4. Clôturer le document en changeant le statut à 'PAID'
    await db.query(
      `UPDATE public.documents SET status = 'PAID', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    await db.query('COMMIT');
    res.status(200).json({ success: true, message: "Réapprovisionnement validé. Les stocks Admin et Revendeur ont été ajustés." });

  } catch (error: any) {
    await db.query('ROLLBACK');
    logger.error(error, '[REM VALIDATE ERROR]');
    res.status(400).json({ success: false, error: error.message || "Erreur lors de la validation du stock." });
  }
};

/**
 * @desc    Admin : Récupère toutes les demandes de réapprovisionnement de l'entreprise
 * @route   GET /api/restock/admin/pending
 */
export const getPendingRestocks = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user; // Doit être ADMIN ou STAFF

  try {
    const query = `
      SELECT 
        d.id as document_id,
        d.number as document_number,
        d.total_amount,
        d.created_at,
        d.status,
        u.first_name || ' ' || u.last_name as reseller_name
      FROM public.documents d
      JOIN public.users u ON d.reseller_id = u.id
      WHERE d.company_id = $1 AND d.type = 'RESTOCK_REQUEST'
      ORDER BY d.created_at DESC
    `;
    
    const result = await db.query(query, [user.companyId]);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: "Erreur lors de la récupération des demandes." });
  }
};
/**
 * @desc    Récupère les articles détaillés d'un document (Vente ou Restock)
 * @route   GET /api/sales/documents/:id/items
 */
export const getDocumentItems = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const query = `
      SELECT 
        di.id,
        di.product_id,
        p.name as product_name,
        di.quantity,
        di.unit_price,
        di.total_price
      FROM public.document_items di
      JOIN public.products p ON di.product_id = p.id
      WHERE di.document_id = $1
    `;
    
    const result = await db.query(query, [id]);
    
    // On renvoie directement le tableau dans l'objet "data" pour correspondre au frontend
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    logger.error(error, '[GET DOCUMENT ITEMS ERROR]');
    res.status(500).json({ success: false, error: "Erreur lors de la récupération des articles du document." });
  }
};