import request from 'supertest';
import express from 'express';
import { salesRouter } from '../src/routes/sales.routes';
import { db } from '../src/config/db';

const app = express();
app.use(express.json());
// Simulation du middleware d'authentification injectant la session d'entreprise africaine
app.use('/api/sales', (req, res, next) => {
  req.user = { companyId: 'bf30cd12-9c1d-4074-b4a0-000000000000' };
  next();
}, salesRouter);

jest.mock('../src/config/db', () => ({
  db: { query: jest.fn() }
}));

const mockedDbQuery = jest.mocked(db.query);

describe('📈 Suite de Tests TDD - Module REM Sales', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('RED -> GREEN: Devrait générer une facture avec ses lignes d articles associés', async () => {
    // Mock de la transaction d'insertion du document
    mockedDbQuery.mockResolvedValueOnce({ 
      rows: [{ id: 'doc-12345', number: 'FACT-2026-001', total_amount: 150000 }] 
    } as any);
    
    // Mock de l'insertion des articles de la facture
    mockedDbQuery.mockResolvedValueOnce({ rows: [] } as any);

    const response = await request(app)
      .post('/api/sales/documents')
      .send({
        clientId: 'client-999',
        type: 'INVOICE',
        items: [
          { productId: 'prod-001', quantity: 2, unitPrice: 75000 }
        ]
      });

    expect(response.status).toBe(201);
    expect(response.body.document).toHaveProperty('number');
    expect(response.body.document.total_amount).toBe(150000);
  });
});
