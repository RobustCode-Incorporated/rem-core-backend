import request from 'supertest';
import express from 'express';
import { salesRouter } from '../src/routes/sales.routes';
import { db } from '../src/config/db';

// 1. On configure l'application Express de test
const app = express();
app.use(express.json());

// 2. On court-circuite le middleware d'authentification UNIQUEMENT pour ce test
jest.mock('../src/middlewares/auth.middleware', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    // On simule un utilisateur africain connecté et injecté par le middleware
    req.user = {
      id: 'user-uuid-999',
      email: 'test@boutique.sn',
      companyId: 'bf30cd12-9c1d-4074-b4a0-000000000000',
      role: 'ADMIN'
    };
    next(); // On laisse passer la requête vers le contrôleur
  },
}));

// 3. On mock le module de base de données Neon
jest.mock('../src/config/db', () => ({
  db: {
    query: jest.fn(),
    end: jest.fn(),
  },
}));

const mockedDbQuery = jest.mocked(db.query);

// On déclare les routes APRÈS avoir mocké le middleware pour que les changements soient pris en compte
app.use('/api/sales', salesRouter);

describe('📈 Suite de Tests TDD - Module REM Sales', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await db.end();
  });

  it('crée la facture dans l entreprise du jeton, même si la requête en désigne une autre', async () => {
    mockedDbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM public.products')) {
        return { rows: [{ id: 'prod-1', selling_price: 50000, name: 'Ordinateur' }] } as any;
      }
      if (sql.includes('INSERT INTO documents')) return { rows: [{ id: 'doc-12345' }] } as any;
      return { rows: [], rowCount: 1 } as any;
    });

    const response = await request(app)
      .post('/api/sales/documents')
      .send({
        clientId: 'client-999',
        type: 'INVOICE',
        status: 'DRAFT',
        company_id: 'another-company',
        items: [{ productId: 'prod-1', quantity: 3 }],
      });

    expect(response.status).toBe(201);
    const productLookup = mockedDbQuery.mock.calls.find(([sql]) => String(sql).includes('FROM public.products'));
    expect(productLookup?.[1]).toEqual(['prod-1', 'bf30cd12-9c1d-4074-b4a0-000000000000']);
    const insert = mockedDbQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO documents'));
    expect(insert?.[1]?.[0]).toBe('bf30cd12-9c1d-4074-b4a0-000000000000');
    expect(insert?.[1]?.[5]).toBe(150000);
    const allParams = mockedDbQuery.mock.calls.flatMap(([, params]) => (params as unknown[]) ?? []);
    expect(allParams).not.toContain('another-company');
  });
});