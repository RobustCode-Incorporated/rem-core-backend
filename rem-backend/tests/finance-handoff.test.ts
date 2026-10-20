import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { authRouter } from '../src/routes/auth.routes';
import { db } from '../src/config/db';

jest.mock('../src/config/db', () => ({
  db: { query: jest.fn(), end: jest.fn(), connect: jest.fn() },
}));

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

const SSO = 'erp-sso-test-secret-of-at-least-32-characters';
const session = (role = 'ADMIN') =>
  jwt.sign({ id: 'user-1', companyId: 'company-1', role, email: 'a@b.be' }, process.env.JWT_SECRET as string);
const row = (role = 'ADMIN') => ({
  rows: [{ id: 'user-1', email: 'a@b.be', first_name: 'Awa', last_name: 'Diop', role, company_id: 'company-1', company_name: 'Boutique Awa' }],
});

describe('Lien vers REM Finance', () => {
  afterEach(() => { delete process.env.ERP_SSO_SECRET; });

  it("signe un jeton d'une minute pour REM Finance, avec l'entreprise de la session", async () => {
    process.env.ERP_SSO_SECRET = SSO;
    jest.mocked(db.query).mockResolvedValueOnce(row() as any);
    const response = await request(app).post('/api/auth/finance-handoff').set('Authorization', `Bearer ${session()}`);
    expect(response.status).toBe(200);
    const token = String(response.body.url).split('#token=')[1];
    expect(response.body.url).toMatch(/^https:\/\/foa\.robust-code\.com\/sso\/erp#token=/);
    const claims = jwt.verify(token, SSO, { algorithms: ['HS256'], audience: 'rem-finance', issuer: 'rem-erp' }) as any;
    expect(claims).toMatchObject({ sub: 'user-1', role: 'ADMIN', company: { id: 'company-1', name: 'Boutique Awa' }, name: 'Awa Diop' });
    expect(claims.exp - claims.iat).toBe(60);
    expect(jest.mocked(db.query).mock.calls[0][1]).toEqual(['user-1', 'company-1']);
  });

  it("refuse sans secret, et pour un revendeur", async () => {
    const off = await request(app).post('/api/auth/finance-handoff').set('Authorization', `Bearer ${session()}`);
    expect(off.status).toBe(503);
    process.env.ERP_SSO_SECRET = SSO;
    jest.mocked(db.query).mockResolvedValueOnce(row('RESELLER') as any);
    const reseller = await request(app).post('/api/auth/finance-handoff').set('Authorization', `Bearer ${session('RESELLER')}`);
    expect(reseller.status).toBe(403);
  });
});
