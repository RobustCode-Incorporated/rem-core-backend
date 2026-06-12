import { Request, Response } from 'express';
import { db } from '../config/db';
import pino from 'pino';

const logger = pino({ transport: { target: 'pino-pretty' } });

/**
 * Logique de décrémentation intelligente (Hub-and-Spoke)
 */
const updateInventory = async (client: any, productId: string, quantity: number, user: any, companyId: string) => {
  if (user.role === 'STAFF') {
    // Décrémentation du stock revendeur
    await client.query(
      `UPDATE public.reseller_stocks 
       SET quantity = quantity - $1 
       WHERE reseller_id = $2 AND product_id = $3`,
      [quantity, user.id, productId]
    );
  } else {
    // Décrémentation du stock central Admin
    await client.query(
      `UPDATE public.products 
       SET stock_quantity = stock_quantity - $1 
       WHERE id = $2 AND company_id = $3`,
      [quantity, productId, companyId]
    );
  }
};

// ==========================================
// NEW: ENCAISSEMENT DIRECT CAISSE / VENTE AU DÉTAIL (QuickSale)
// ==========================================
export const processRetailCheckout = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user; // Le revendeur connecté (STAFF)
  const { client, items } = req.body;

  if (!client || !client.name || !items || items.length === 0) {
    res.status(400).json({ success: false, message: "Données de vente incomplètes." });
    return;
  }

  logger.info({ resellerId: user?.id, companyId: client.company_id }, `[REM CAISSE] Début de transaction vente directe au détail.`);

  try {
    await db.query('BEGIN');

    // 1. Upsert Client (recherche par nom si existant pour cette entreprise)
    let clientId: string;
    const checkClient = await db.query(
      `SELECT id FROM public.clients WHERE name = $1 AND company_id = $2 LIMIT 1`,
      [client.name, client.company_id]
    );

    if (checkClient.rows.length > 0) {
      clientId = checkClient.rows[0].id;
      logger.info({ clientId }, `[REM CAISSE] Client existant identifié.`);
    } else {
      const insertClient = await db.query(
        `INSERT INTO public.clients (company_id, name, phone, email, address)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [client.company_id, client.name, client.phone, client.email, client.address]
      );
      clientId = insertClient.rows[0].id;
      logger.info({ clientId }, `[REM CAISSE] Nouveau profil client créé à la volée.`);
    }

    // Génération du numéro de facture unique pour la caisse
    const docNumber = `CASH-${Date.now().toString().slice(-6)}`;

    // 2. Création de la FACTURE (Type SALE, payé immédiatement à la caisse)
    const documentQuery = `
      INSERT INTO public.documents (company_id, reseller_id, client_id, type, number, status, total_amount)
      VALUES ($1, $2, $3, 'SALE', $4, 'PAID', 0)
      RETURNING id;
    `;
    const docRes = await db.query(documentQuery, [client.company_id, user.id, clientId, docNumber]);
    const documentId = docRes.rows[0].id;

    let globalTotalAmount = 0;

    // 3. Boucle de validation et déduction de stock par produit
    for (const item of items) {
      // Vérification et verrouillage (FOR UPDATE) du stock pour éviter les conditions de concurrence
      const stockCheck = await db.query(
        `SELECT quantity FROM public.reseller_stocks 
         WHERE reseller_id = $1 AND product_id = $2 FOR UPDATE`,
        [user.id, item.product_id]
      );

      if (stockCheck.rows.length === 0 || stockCheck.rows[0].quantity < item.quantity) {
        throw new Error(`Stock insuffisant au dépôt pour le produit sélectionné.`);
      }

      // Soustraction du stock réel du revendeur
      await db.query(
        `UPDATE public.reseller_stocks 
         SET quantity = quantity - $1, updated_at = NOW()
         WHERE reseller_id = $2 AND product_id = $3`,
        [item.quantity, user.id, item.product_id]
      );

      // Récupération stricte du prix (selling_price) configuré sur la marchandise centrale
      const priceRes = await db.query(`SELECT selling_price FROM public.products WHERE id = $1`, [item.product_id]);
      const unitPrice = Number(priceRes.rows[0]?.selling_price || 0);
      const itemTotal = unitPrice * item.quantity;
      globalTotalAmount += itemTotal;

      // Liaison à la facture détail (document_items)
      await db.query(
        `INSERT INTO public.document_items (document_id, product_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [documentId, item.product_id, item.quantity, unitPrice, itemTotal]
      );
    }

    // Mise à jour finale du montant total réel cumulé de la vente directe
    await db.query(`UPDATE public.documents SET total_amount = $1 WHERE id = $2`, [globalTotalAmount, documentId]);

    await db.query('COMMIT');
    logger.info({ documentId, docNumber, total: globalTotalAmount }, `[REM CAISSE SUCCESS] Vente au détail encaissée et stock déduit.`);
    
    res.status(201).json({ success: true, message: "Vente encaissée avec succès", documentId });

  } catch (error: any) {
    await db.query('ROLLBACK');
    logger.error(error, `[REM CAISSE ERROR] Échec de la vente au détail.`);
    res.status(500).json({ success: false, message: error.message || "Erreur lors du traitement de la vente." });
  }
};

// ==========================================
// 1. CRÉATION DE DOCUMENTS COMMERCIAUX (Strictement au selling_price)
// ==========================================
export const createSalesDocument = async (req: Request, res: Response): Promise<void> => {
  const { clientId, type, items, status, company_id } = req.body;
  const user = (req as any).user; 
  const companyId = company_id || user?.companyId;

  logger.info({ type, companyId, userId: user?.id }, `[REM SALES] Début de création de document. Nombre d'articles: ${items?.length}`);

  try {
    await db.query('BEGIN');

    let totalAmount = 0;
    const computedItems = [];

    for (const item of items) {
      const pid = item.product_id || item.productId;

      if (!pid) {
        logger.error(item, "[REM PRICING ERROR] Un article ne possède pas d'ID de produit valide");
        throw new Error("ID de produit manquant dans la requête");
      }

      const prodRes = await db.query(
        'SELECT id, selling_price, name FROM public.products WHERE id = $1 AND company_id = $2',
        [pid, companyId]
      );

      let unitPrice = 0;

      if (prodRes.rows.length > 0) {
        const dbProduct = prodRes.rows[0];
        unitPrice = Number(dbProduct.selling_price);
        logger.info(`[REM PRICING MATCH] Produit trouvé : "${dbProduct.name}" (${pid}). Application du selling_price BDD : ${unitPrice} $`);
      } else {
        const frontPrice = item.unit_price || item.unitPrice || 0;
        logger.warn(`[REM PRICING WARNING] Produit ${pid} INTROUVABLE en BDD. Prix front appliqué.`);
        unitPrice = Number(frontPrice);
      }

      const quantity = item.quantity || 1;
      const lineTotal = quantity * unitPrice;
      totalAmount += lineTotal;

      computedItems.push({
        productId: pid,
        quantity,
        unitPrice,
        lineTotal
      });
    }

    const prefix = type === 'QUOTE' ? 'DEVIS' : type === 'RESTOCK_REQUEST' ? 'RESTOCK' : 'FACT';
    const docNumber = `${prefix}-${Date.now().toString().slice(-6)}`;

    const docQuery = `
      INSERT INTO documents (company_id, client_id, type, number, status, total_amount, reseller_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id;
    `;
    
    const finalResellerId = user?.role === 'STAFF' ? user.id : (req.body.reseller_id || null);
    const docRes = await db.query(docQuery, [companyId, clientId || null, type, docNumber, status, totalAmount, finalResellerId]);
    const docId = docRes.rows[0].id;

    for (const item of computedItems) {
      await db.query(
        'INSERT INTO document_items (document_id, product_id, quantity, unit_price, total_price) VALUES ($1, $2, $3, $4, $5)',
        [docId, item.productId, item.quantity, item.unitPrice, item.lineTotal]
      );

      if (status === 'PAID' && item.productId) {
        await updateInventory(db, item.productId, item.quantity, user, companyId);
      }
    }

    await db.query('COMMIT');
    logger.info({ docId, docNumber, totalAmount }, "[REM SALES SUCCESS] Document créé avec succès au selling_price");
    
    res.status(201).json({ message: 'Document enregistré avec succès', documentId: docId, totalAmount });
  } catch (error: any) {
    await db.query('ROLLBACK');
    logger.error(error, '[REM SALES ERROR] Échec de la transaction');
    res.status(500).json({ error: 'Erreur lors du calcul ou de la transaction.', details: error.message });
  }
};

// ==========================================
// 2. CRÉATION DE CLIENTS - AVEC ADRESSE
// ==========================================
export const createClient = async (req: Request, res: Response): Promise<void> => {
  const { name, email, phone, address, company_id } = req.body;
  const companyId = company_id || (req as any).user?.companyId;

  if (!name || name.trim() === '') {
    res.status(400).json({ error: 'Le nom du client est obligatoire.' });
    return;
  }

  try {
    const clientQuery = `
      INSERT INTO clients (company_id, name, email, phone, address, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, company_id, name, email, phone, address, created_at;
    `;
    
    const result = await db.query(clientQuery, [companyId, name, email || null, phone || null, address || null]);
    res.status(201).json({ message: 'Client créé avec succès', client: result.rows[0] });
  } catch (error: any) {
    if (error.code === '23505') {
       res.status(409).json({ error: 'Un client avec cet identifiant ou email existe déjà.' });
       return;
    }
    res.status(500).json({ error: 'Erreur fatale lors de la création du client.' });
  }
};

// ==========================================
// 3. ENCAISSEMENT ET MISE À JOUR DU STATUT (ADMIN / CENTRAL)
// ==========================================
export const updateDocumentStatus = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status: newStatus, company_id } = req.body; 
  const user = (req as any).user; 
  const companyId = user?.companyId || company_id || req.query.company_id;

  if (user?.role === 'STAFF') {
    res.status(403).json({ success: false, error: "Action non autorisée. Seule l'administration peut modifier ce statut." });
    return;
  }

  try {
    await db.query('BEGIN');

    const docQuery = `SELECT type, status, reseller_id FROM documents WHERE id = $1 AND company_id = $2`;
    const docRes = await db.query(docQuery, [id, companyId]);

    if (docRes.rows.length === 0) {
      await db.query('ROLLBACK');
      res.status(404).json({ error: 'Document introuvable.' });
      return;
    }

    const { type, status: oldStatus, reseller_id: resellerId } = docRes.rows[0];

    if (oldStatus === newStatus) {
      await db.query('ROLLBACK');
      res.status(400).json({ error: 'Même statut demandé.' });
      return;
    }

    const itemsQuery = `SELECT product_id, quantity FROM document_items WHERE document_id = $1`;
    const itemsRes = await db.query(itemsQuery, [id]);

    if (oldStatus === 'DRAFT' && newStatus === 'PAID') {
      if (type === 'RESTOCK_REQUEST') {
        for (const item of itemsRes.rows) {
          if (!item.product_id) continue;
          await db.query(`UPDATE public.products SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND company_id = $3`, [item.quantity, item.product_id, companyId]);
          if (resellerId) {
            await db.query(`
              INSERT INTO public.reseller_stocks (reseller_id, product_id, quantity)
              VALUES ($1, $2, $3) ON CONFLICT (reseller_id, product_id) 
              DO UPDATE SET quantity = public.reseller_stocks.quantity + EXCLUDED.quantity
            `, [resellerId, item.product_id, item.quantity]);
          }
        }
      } else {
        for (const item of itemsRes.rows) {
          if (!item.product_id) continue;
          if (resellerId) {
            await db.query(`UPDATE public.reseller_stocks SET quantity = quantity - $1 WHERE reseller_id = $2 AND product_id = $3`, [item.quantity, resellerId, item.product_id]);
          } else {
            await db.query(`UPDATE public.products SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND company_id = $3`, [item.quantity, item.product_id, companyId]);
          }
        }
      }
    }

    else if (oldStatus === 'PAID' && newStatus === 'CANCELLED') {
      if (type === 'RESTOCK_REQUEST') {
        for (const item of itemsRes.rows) {
          if (!item.product_id) continue;
          if (resellerId) {
            await db.query(`UPDATE public.reseller_stocks SET quantity = quantity - $1 WHERE reseller_id = $2 AND product_id = $3`, [item.quantity, resellerId, item.product_id]);
          }
          await db.query(`UPDATE public.products SET stock_quantity = stock_quantity + $1 WHERE id = $2 AND company_id = $3`, [item.quantity, item.product_id, companyId]);
        }
      } else {
        for (const item of itemsRes.rows) {
          if (!item.product_id) continue;
          if (resellerId) {
            await db.query(`UPDATE public.reseller_stocks SET quantity = quantity + $1 WHERE reseller_id = $2 AND product_id = $3`, [item.quantity, resellerId, item.product_id]);
          } else {
            await db.query(`UPDATE public.products SET stock_quantity = stock_quantity + $1 WHERE id = $2 AND company_id = $3`, [item.quantity, item.product_id, companyId]);
          }
        }
      }
    }

    await db.query(`UPDATE documents SET status = $1, updated_at = NOW() WHERE id = $2 AND company_id = $3`, [newStatus, id, companyId]);
    await db.query('COMMIT');
    
    res.status(200).json({ success: true, message: "Document mis à jour avec succès" });
  } catch (error) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: 'Erreur lors du changement de statut.' });
  }
};

// ==========================================
// 4. SYNCHRONISATION OFFLINE-FIRST (MOBILE)
// ==========================================
export const syncOfflineDocument = async (req: Request, res: Response): Promise<void> => {
  const { id, type, number, status, totalAmount, items } = req.body;
  const companyId = (req as any).user?.companyId;

  try {
    await db.query('BEGIN');

    const syncDocQuery = `
      INSERT INTO documents (id, company_id, type, number, status, total_amount, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, total_amount = EXCLUDED.total_amount, updated_at = NOW();
    `;
    await db.query(syncDocQuery, [id, companyId, type, number, status, Number(totalAmount)]);
    await db.query('DELETE FROM document_items WHERE document_id = $1;', [id]);

    for (const item of items) {
      const finalProductId = item.product_id || item.productId;
      await db.query(`
        INSERT INTO document_items (document_id, product_id, quantity, unit_price, total_price)
        VALUES ($1, $2, $3, $4, $5);
      `, [id, finalProductId, item.quantity, item.unit_price || item.unitPrice || 0, item.total_price || item.totalPrice || 0]);
    }

    await db.query('COMMIT');
    res.status(201).json({ success: true, message: 'Synchronisé avec succès' });
  } catch (error) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: 'Erreur lors de la synchronisation.' });
  }
};

// ==========================================
// 5. RÉCUPÉRATION PAGINÉE ET FILTRÉE
// ==========================================
export const getSalesDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.query.company_id || (req as any).user?.companyId;
    if (!companyId) {
      res.status(400).json({ success: false, error: "Missing company identity" });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || '';
    const status = (req.query.status as string) || '';

    let queryConditions = 'WHERE d.company_id = $1';
    const queryParams: any[] = [companyId];
    let paramIndex = 2;

    if (status) {
      queryConditions += ` AND d.status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    if (search) {
      queryConditions += ` AND (d.number ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex} OR r.name ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const dataQuery = `
      SELECT d.id, d.number, d.type, d.status, d.total_amount, d.created_at, 
             c.name as client_name, r.name as reseller_name, r.deposit_name as depot_name
      FROM documents d
      LEFT JOIN clients c ON d.client_id = c.id
      LEFT JOIN public.resellers r ON d.reseller_id = r.id
      ${queryConditions} ORDER BY d.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    const [dataResult, countResult] = await Promise.all([
      db.query(dataQuery, [...queryParams, limit, offset]),
      db.query(`SELECT COUNT(*) FROM documents d LEFT JOIN clients c ON d.client_id = c.id LEFT JOIN public.resellers r ON d.reseller_id = r.id ${queryConditions};`, queryParams)
    ]);

    const totalItems = parseInt(countResult.rows[0].count) || 0;
    res.status(200).json({
      success: true,
      data: dataResult.rows,
      meta: { totalItems, totalPages: Math.ceil(totalItems / limit), currentPage: page, limit }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};