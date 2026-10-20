import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { db } from '../config/db';

// REM Finance ADR-008. A one-minute token that opens REM Finance (foa.robust-code.com)
// already signed in, in the same company. Signed with ERP_SSO_SECRET, shared with
// REM Finance and different from JWT_SECRET; there is no fallback.
const MIN_SECRET_LENGTH = 32;
const FINANCE_URL = process.env.FINANCE_URL || 'https://foa.robust-code.com';

export const createFinanceHandoff = async (req: Request, res: Response): Promise<void> => {
  const secret = process.env.ERP_SSO_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    res.status(503).json({ error: "REM Finance n'est pas encore relié à cet ERP." });
    return;
  }
  const session = (req as any).user;
  const result = await db.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, c.id AS company_id, c.name AS company_name
       FROM users u JOIN companies c ON c.id = u.company_id
      WHERE u.id = $1 AND u.company_id = $2`,
    [session?.id, session?.companyId],
  );
  const user = result.rows[0];
  if (!user) {
    res.status(401).json({ error: 'Session invalide.' });
    return;
  }
  if (user.role === 'RESELLER') {
    res.status(403).json({ error: "REM Finance est réservé à l'équipe de l'entreprise." });
    return;
  }

  const token = jwt.sign(
    {
      email: user.email,
      name: [user.first_name, user.last_name].filter(Boolean).join(' '),
      role: user.role,
      company: { id: user.company_id, name: user.company_name },
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: 60,
      issuer: 'rem-erp',
      audience: 'rem-finance',
      subject: String(user.id),
      jwtid: randomUUID(),
    },
  );
  res.status(200).json({ url: `${FINANCE_URL}/sso/erp#token=${token}` });
};
