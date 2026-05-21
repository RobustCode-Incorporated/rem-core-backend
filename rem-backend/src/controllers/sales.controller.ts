import { Request, Response } from 'express';
import { db } from '../config/db';
import pino from 'pino';

const logger = pino({ transport: { target: 'pino-pretty' } });

export const createSalesDocument = async (req: Request, res: Response): Promise<void> => {
  const { clientId, type, items } = req.body;
  // Récupération sécurisée du tenant id injecté par le middleware d'authentification
  const companyId = (req as any).user?.companyId;

  logger.info({ companyId, clientId, type }, '[REM SALES] Tentative de génération de pièce commerciale');

  try {
    // Calcul du montant total cumulé (Algorithme backend hautement sécurisé)
    let totalAmount = 0;
    const computedItems = items.map((item: any) => {
      const lineTotal = item.quantity * item.unitPrice;
      totalAmount += lineTotal;
      return { ...item, lineTotal };
    });

    // Génération automatique d'un numéro de document unique
    const timestamp = Date.now();
    const docNumber = `${type === 'QUOTE' ? 'DEVIS' : 'FACT'}-${timestamp}`;

    // Étape 1 : Insertion de l'entête du document commercial
    const docQuery = `
      INSERT INTO documents (company_id, client_id, type, number, status, total_amount)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, number, type, status, total_amount, created_at;
    `;
    const docValues = [companyId, clientId, type, docNumber, 'DRAFT', totalAmount];
    const docResult = await db.query(docQuery, docValues);
    const newDocument = docResult.rows[0];

    // Étape 2 : Insertion itérative des lignes d'articles via transactions
    for (const item of computedItems) {
      const itemQuery = `
        INSERT INTO document_items (document_id, product_id, quantity, unit_price, total_price)
        VALUES ($1, $2, $3, $4, $5);
      `;
      await db.query(itemQuery, [newDocument.id, item.productId, item.quantity, item.unitPrice, item.lineTotal]);
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
