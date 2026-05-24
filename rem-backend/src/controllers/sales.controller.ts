import { Request, Response } from 'express';
import { db } from '../config/db';
import pino from 'pino';
import { SalesModel } from '../models/sales.model';

const logger = pino({ transport: { target: 'pino-pretty' } });

// ==========================================
// 1. CRÉATION DE DOCUMENTS COMMERCIAUX
// ==========================================
export const createSalesDocument = async (req: Request, res: Response): Promise<void> => {
  const { clientId, type, items } = req.body;
  const companyId = (req as any).user?.companyId;

  logger.info({ companyId, clientId, type }, '[REM SALES] Tentative de génération de pièce commerciale');

  try {
    let totalAmount = 0;
    const computedItems = items.map((item: any) => {
      // Sécurité : Supporte à la fois camelCase (mobile) et snake_case
      const unitPrice = item.unitPrice !== undefined ? item.unitPrice : item.unit_price;
      const quantity = item.quantity || 1;
      
      const lineTotal = quantity * unitPrice;
      totalAmount += lineTotal;
      
      return { ...item, quantity, unitPrice, lineTotal };
    });

    const timestamp = Date.now();
    const docNumber = `${type === 'QUOTE' ? 'DEVIS' : 'FACT'}-${timestamp}`;

    const docQuery = `
      INSERT INTO documents (company_id, client_id, type, number, status, total_amount)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, number, type, status, total_amount, created_at;
    `;
    const docValues = [companyId, clientId, type, docNumber, 'DRAFT', totalAmount];
    const docResult = await db.query(docQuery, docValues);
    const newDocument = docResult.rows[0];

    for (const item of computedItems) {
      // 🛡️ CORRECTION CHIRURGICALE : Si le product_id est générique/fictif, on passe NULL 
      // pour éviter la violation de clé étrangère PostgreSQL (Constraint 23503)
      const rawProductId = item.productId || item.product_id;
      const finalProductId = (rawProductId === '00000000-0000-0000-0000-000000000000' || !rawProductId)
        ? null 
        : rawProductId;

      const itemQuery = `
        INSERT INTO document_items (document_id, product_id, quantity, unit_price, total_price)
        VALUES ($1, $2, $3, $4, $5);
      `;
      await db.query(itemQuery, [
        newDocument.id, 
        finalProductId, 
        item.quantity, 
        item.unitPrice, 
        item.lineTotal
      ]);
    }

    logger.info({ documentId: newDocument.id, number: docNumber }, '[REM SALES SUCCESS] Document et lignes enregistrés');

    res.status(201).json({
      message: 'Document commercial créé avec succès',
      document: newDocument,
      items: computedItems
    });
  } catch (error) {
    logger.error(error, '[REM SALES ERROR] Échec de la transaction commerciale');
    res.status(500).json({ error: 'Erreur fatale lors de la création du document commercial.' });
  }
};

// ==========================================
// 2. NOUVEAU TICKET : CRÉATION DE CLIENTS (REM-204)
// ==========================================
export const createClient = async (req: Request, res: Response): Promise<void> => {
  const { name, email, phone } = req.body;
  const companyId = (req as any).user?.companyId;

  logger.info({ companyId, name, email }, '[REM CLIENTS] Tentative de création de client');

  // Validation défensive d'entrée
  if (!name || name.trim() === '') {
    res.status(400).json({ error: 'Le nom du client est obligatoire.' });
    return;
  }

  try {
    // Insertion SQL sécurisée avec multi-tenant. 
    const clientQuery = `
      INSERT INTO clients (company_id, name, email, phone, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, company_id, name, email, phone, created_at;
    `;
    
    const clientValues = [companyId, name, email || null, phone || null];
    const result = await db.query(clientQuery, clientValues);
    const newClient = result.rows[0];

    logger.info({ clientId: newClient.id, name: newClient.name }, '[REM CLIENTS SUCCESS] Client créé avec succès');

    res.status(201).json({
      message: 'Client créé avec succès',
      client: newClient
    });
  } catch (error: any) {
    logger.error(error, '[REM CLIENTS ERROR] Échec de la création du client');
    
    // Gestion propre des doublons de contraintes si email unique par exemple
    if (error.code === '23505') {
       res.status(409).json({ error: 'Un client avec cet identifiant ou email existe déjà.' });
       return;
    }

    res.status(500).json({ error: 'Erreur fatale lors de la création du client.' });
  }
};

// ==========================================
// 3. ENCAISSEMENT VENTE (REM-205)
// ==========================================
export const updateDocumentStatus = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body;
  const companyId = (req as any).user?.companyId;

  logger.info({ documentId: id, status, companyId }, '[REM SALES] Tentative de mise à jour du statut');

  // Validation des statuts autorisés
  const allowedStatuses = ['DRAFT', 'SENT', 'PAID', 'CANCELLED'];
  if (!allowedStatuses.includes(status)) {
     res.status(400).json({ error: `Statut invalide. Choisir parmi : ${allowedStatuses.join(', ')}` });
     return;
  }

  try {
    // Requête SQL multi-tenant pour sécuriser la modification
    const query = `
      UPDATE documents 
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND company_id = $3
      RETURNING id, number, type, status, total_amount, updated_at;
    `;
    
    const result = await db.query(query, [status, id, companyId]);

    if (result.rows.length === 0) {
       res.status(404).json({ error: 'Document introuvable ou non autorisé.' });
       return;
    }

    logger.info({ documentId: id, status }, '[REM SALES SUCCESS] Statut mis à jour avec succès');

    res.status(200).json({
      message: 'Statut du document mis à jour avec succès',
      document: result.rows[0]
    });
  } catch (error) {
    logger.error(error, '[REM SALES ERROR] Échec de la mise à jour du statut');
    res.status(500).json({ error: 'Erreur fatale lors de la modification du statut.' });
  }
};
// ==========================================
// 4. SYNCHRONISATION OFFLINE-FIRST (MOBILE)
// ==========================================
export const syncOfflineDocument = async (req: Request, res: Response): Promise<void> => {
  const { id, type, number, status, totalAmount } = req.body;
  const companyId = (req as any).user?.companyId; // Récupération du multi-tenant sécurisé

  logger.info({ companyId, documentId: id, number }, '[REM SALES SYNC] Réception d\'un document synchronisé');

  if (!id || !type || !number || !status || totalAmount === undefined) {
    res.status(400).json({ error: 'Champs de synchronisation obligatoires manquants.' });
    return;
  }

  try {
    // Appel du modèle mis à jour
    await SalesModel.syncMobileDocument({
      id,
      companyId,
      type,
      number,
      status,
      totalAmount: Number(totalAmount)
    });

    logger.info({ documentId: id, number }, '[REM SALES SYNC SUCCESS] Document poussé en base Neon');

    res.status(201).json({
      success: true,
      message: 'Document de vente synchronisé avec succès',
      documentId: id
    });
  } catch (error: any) {
    logger.error(error, '[REM SALES SYNC ERROR] Échec de la synchronisation');
    
    if (error.code === '23505') {
      res.status(409).json({ error: 'Un document avec ce numéro ou cet identifiant existe déjà.' });
      return;
    }

    res.status(500).json({ error: 'Erreur fatale lors de la synchronisation en base.' });
  }
};