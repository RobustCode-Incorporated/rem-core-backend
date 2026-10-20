import request from 'supertest';
import express from 'express';
import { authRouter } from '../src/routes/auth.routes';
import { db } from '../src/config/db';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

// 1. On mock le module de base de données Neon
jest.mock('../src/config/db', () => ({
  db: {
    query: jest.fn(),
    end: jest.fn(), // Ajout du mock pour la fonction de fermeture
  },
}));

// 2. Utilisation de la méthode native et standard de Jest pour typer le mock (zéro bug Babel)
const mockedDbQuery = jest.mocked(db.query);
const mockedDbEnd = jest.mocked(db.end);

describe('🔒 Suite de Tests - Authentification (TDD)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Nettoyage final : Fermeture propre des connexions asynchrones à la fin de la suite de tests
  afterAll(async () => {
    await db.end();
  });

  it('RED: Devrait rejeter l inscription si l email existe déjà', async () => {
    mockedDbQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'existing-uuid' }] } as any);

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        companyName: 'Boutique Africa',
        country: 'Sénégal',
        firstName: 'Awa',
        lastName: 'Diop',
        email: 'awa@boutique.sn',
        password: 'Password123!',
        acceptedConfidentialityAgreement: true,
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'Cet e-mail est déjà utilisé.');
  });

  it('GREEN: Devrait créer une entreprise et un utilisateur avec un mot de passe haché', async () => {
    mockedDbQuery.mockImplementation(async (sql: string) => {
      if (sql.startsWith('SELECT id FROM users')) return { rowCount: 0, rows: [] } as any;
      if (sql.startsWith('INSERT INTO companies')) return { rows: [{ id: 'company-uuid' }] } as any;
      if (sql.startsWith('INSERT INTO users'))
        return { rows: [{ id: 'user-uuid', email: 'awa@boutique.sn', role: 'ADMIN' }] } as any;
      return { rows: [], rowCount: 0 } as any;
    });

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        companyName: 'Boutique Africa',
        country: 'Sénégal',
        firstName: 'Awa',
        lastName: 'Diop',
        email: 'awa@boutique.sn',
        password: 'Password123!',
        acceptedConfidentialityAgreement: true,
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('token');
  });
  
});