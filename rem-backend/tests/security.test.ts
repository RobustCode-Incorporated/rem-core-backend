import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { authRouter } from '../src/routes/auth.routes';
import { salesRouter } from '../src/routes/sales.routes';
import { jwtSecret } from '../src/config/jwt';
import { db } from '../src/config/db';

jest.mock('../src/config/db', () => ({
  db: { query: jest.fn(), end: jest.fn(), connect: jest.fn() },
}));

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/sales', salesRouter);

const OWN = 'company-own';
const token = (secret = process.env.JWT_SECRET as string) =>
  jwt.sign({ id: 'user-1', companyId: OWN, role: 'ADMIN', email: 'a@b.be' }, secret, { expiresIn: '1h' });

describe('Sécurité des sessions et des entreprises', () => {
  it('refuse de démarrer sans secret, ou avec un secret trop court', () => {
    const saved = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => jwtSecret()).toThrow('JWT_SECRET');
    process.env.JWT_SECRET = 'short';
    expect(() => jwtSecret()).toThrow('JWT_SECRET');
    process.env.JWT_SECRET = saved;
  });

  it("refuse un jeton signé avec l'ancien secret par défaut", async () => {
    const forged = token('SuperSecretKeyREM2026!');
    const response = await request(app)
      .get(`/api/auth/companies/${OWN}`)
      .set('Authorization', `Bearer ${forged}`);
    expect(response.status).toBe(403);
  });

  it("ne montre jamais une autre entreprise que celle du jeton", async () => {
    const response = await request(app)
      .get('/api/auth/companies/company-other')
      .set('Authorization', `Bearer ${token()}`);
    expect(response.status).toBe(404);
    expect(jest.mocked(db.query)).not.toHaveBeenCalled();
  });

  it("exige une session pour modifier le statut d'une facture", async () => {
    const response = await request(app)
      .put('/api/sales/documents/doc-1')
      .send({ status: 'PAID', company_id: OWN });
    expect(response.status).toBe(401);
  });
});
