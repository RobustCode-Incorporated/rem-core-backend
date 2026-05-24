import { db } from '../config/db'; // Alignement sur ton fichier db.ts

export interface SalesSyncInput {
  id: string;
  type: string;
  number: string;
  status: string;
  totalAmount: number;
  companyId: string;
}

export class SalesModel {
  
  // 1. Insertion dans ta vraie table "documents" (sans bloquer sur client_id pour la synchro)
  static async syncMobileDocument(doc: SalesSyncInput): Promise<void> {
    const query = `
      INSERT INTO documents (id, company_id, type, number, status, total_amount, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `;
    const values = [doc.id, doc.companyId, doc.type, doc.number, doc.status, doc.totalAmount];
    await db.query(query, values);
  }

  // 2. Vérifier si une clé d'idempotence existe déjà
  static async getIdempotencyRecord(key: string): Promise<{ status: number; body: any } | null> {
    const query = 'SELECT response_status, response_body FROM idempotency_keys WHERE key = $1';
    const result = await db.query(query, [key]);
    
    if (result.rows.length === 0) return null;
    
    return {
      status: result.rows[0].response_status,
      body: result.rows[0].response_body
    };
  }

  // 3. Sauvegarder une clé d'idempotence avec sa réponse associée
  static async saveIdempotencyRecord(key: string, status: number, body: any): Promise<void> {
    const query = `
      INSERT INTO idempotency_keys (key, response_status, response_body)
      VALUES ($1, $2, $3)
    `;
    await db.query(query, [key, JSON.stringify(body)]);
  }
}