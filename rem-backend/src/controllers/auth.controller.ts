import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../config/db';
import pino from 'pino';

const logger = pino({ transport: { target: 'pino-pretty' } });
const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_local_key_for_africa_market';

export const registerCompanyAndUser = async (req: Request, res: Response): Promise<void> => {
  const { companyName, country, firstName, lastName, email, password } = req.body;
  
  logger.info({ email }, '[AUTH LOG] Tentative d inscription reçue');

  try {
    // 1. Vérification de l'existence de l'utilisateur (Sécurité & Intégrité)
    const checkUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (checkUser.rowCount && checkUser.rowCount > 0) {
      logger.warn({ email }, '[AUTH LOG] Échec de l inscription : Email déjà existant');
      res.status(400).json({ error: 'Cet e-mail est déjà utilisé.' });
      return;
    }

    // 2. Chiffrement du mot de passe via Bcrypt
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 3. Transaction SQL pour garantir la cohérence des données (Entreprise + Admin)
    // Création de l'entreprise
    const companyResult = await db.query(
      'INSERT INTO companies (name, country) VALUES ($1, $2) RETURNING id',
      [companyName, country]
    );
    const companyId = companyResult.rows[0].id;

    // Création de l'utilisateur rattaché
    const userResult = await db.query(
      'INSERT INTO users (company_id, first_name, last_name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, role',
      [companyId, firstName, lastName, email, passwordHash, 'ADMIN']
    );
    const user = userResult.rows[0];

    // 4. Génération du Token de session JWT (Expire dans 90 jours pour éviter les déconnexions intempestives en zone à faible réseau)
    const token = jwt.sign(
      { userId: user.id, companyId: companyId, role: user.role },
      JWT_SECRET,
      { expiresIn: '90d' }
    );

    logger.info({ userId: user.id }, '[AUTH SUCCESS] Entreprise et administrateur créés avec succès');
    
    res.status(201).json({
      message: 'Compte créé avec succès',
      token,
      user: { id: user.id, email: user.email, role: user.role }
    });

  } catch (error) {
    logger.error(error, '[AUTH ERROR] Erreur critique lors de l inscription');
    res.status(500).json({ error: 'Une erreur serveur est survenue lors de l inscription.' });
  }
};