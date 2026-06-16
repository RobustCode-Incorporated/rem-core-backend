import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../config/db';
import pino from 'pino';

const logger = pino({ transport: { target: 'pino-pretty' } });
const SALT_ROUNDS = 12;
// Secret harmonisé avec le middleware
const JWT_SECRET = process.env.JWT_SECRET || 'SuperSecretKeyREM2026!';

// --- LOGIQUE INITIALE : ENREGISTREMENT ADMIN ---
export const registerCompanyAndUser = async (req: Request, res: Response): Promise<void> => {
  const { companyName, country, firstName, lastName, email, password } = req.body;
  
  logger.info({ email }, '[AUTH] Tentative d inscription pour : ' + companyName);

  try {
    const checkUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (checkUser.rowCount && checkUser.rowCount > 0) {
      res.status(400).json({ error: 'Cet e-mail est déjà utilisé.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await db.query('BEGIN');

    // 🎯 AJOUT : Initialisation de la devise par défaut à USD lors de la création
    const companyResult = await db.query(
      'INSERT INTO companies (name, country, currency) VALUES ($1, $2, $3) RETURNING id',
      [companyName, country, 'USD']
    );
    const companyId = companyResult.rows[0].id;

    const userResult = await db.query(
      'INSERT INTO users (company_id, first_name, last_name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, role',
      [companyId, firstName, lastName, email, passwordHash, 'ADMIN']
    );
    
    await db.query('COMMIT');

    const user = userResult.rows[0];
    
    // Normalisation du payload : id au lieu de userId
    const token = jwt.sign(
      { id: user.id, companyId, role: user.role, email: user.email }, 
      JWT_SECRET, 
      { expiresIn: '90d' }
    );

    res.status(201).json({ message: 'Compte créé avec succès', token });

  } catch (error) {
    await db.query('ROLLBACK');
    logger.error(error, '[AUTH ERROR] Échec transactionnel');
    res.status(500).json({ error: 'Erreur interne lors de la création.' });
  }
};

// --- LOGIQUE MISE À JOUR : LOGIN GÉNÉRIQUE ---
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  try {
    const userResult = await db.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);
    if (userResult.rowCount === 0) {
      res.status(401).json({ message: 'Identifiants incorrects.' });
      return;
    }

    const user = userResult.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      res.status(401).json({ message: 'Identifiants incorrects.' });
      return;
    }

    // 🎯 AJOUT CRUCIAL : Récupération des informations de la compagnie pour le Frontend
    const companyResult = await db.query(
      'SELECT plan_type, is_premium, currency FROM companies WHERE id = $1',
      [user.company_id]
    );
    const companyData = companyResult.rows[0] || {};

    // Récupération de l'ID spécifique si c'est un revendeur
    let resellerId = null;
    if (user.role === 'RESELLER') {
      const resellerData = await db.query('SELECT id FROM resellers WHERE email = $1', [email]);
      if (resellerData.rowCount && resellerData.rowCount > 0) {
        resellerId = resellerData.rows[0].id;
      }
    }

    // Normalisation du payload : id au lieu de userId pour s'aligner avec le middleware
    const token = jwt.sign(
      { id: user.id, companyId: user.company_id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '90d' }
    );

    res.status(200).json({
      token,
      user: { 
        id: user.id, 
        resellerId: resellerId, 
        firstName: user.first_name, 
        companyId: user.company_id, 
        role: user.role 
      },
      // 🎯 Injection de la compagnie dans la réponse pour débloquer le routeur Vue
      company: {
        plan_type: companyData.plan_type || 'entrée',
        is_premium: companyData.is_premium || false,
        currency: companyData.currency || 'USD'
      }
    });
  } catch (error) {
    logger.error(error, '[AUTH ERROR] Échec lors du login');
    res.status(500).json({ message: 'Erreur serveur.' });
  }
};

// --- ÉTAPE 6 : SÉCURISATION ET CRÉATION DU RESELLER AVEC FEATURE GATING ---
export const createResellerWithAccess = async (req: Request, res: Response): Promise<void> => {
  const { companyId, firstName, lastName, email, password, phone, deposit_name } = req.body;
  
  logger.info({ email, companyId }, '[AUTH] Interrogation des quotas avant création de revendeur');

  try {
    // 1. Récupérer le plan actuel de l'entreprise
    const companyQuery = await db.query('SELECT plan_type FROM companies WHERE id = $1', [companyId]);
    if (companyQuery.rowCount === 0) {
      res.status(404).json({ error: 'Entreprise introuvable.' });
      return;
    }
    
    const planType = companyQuery.rows[0].plan_type || 'entrée';

    // 2. Compter le nombre actuel de revendeurs actifs pour cette entreprise
    const countQuery = await db.query('SELECT COUNT(*)::int FROM resellers WHERE company_id = $1', [companyId]);
    const currentResellerCount = countQuery.rows[0].count;

    // 3. Définir et évaluer les barrières de limites du modèle SaaS
    let allowedLimit = 3; // Seuil par défaut du plan 'entrée'
    
    if (planType === 'standard') {
      allowedLimit = 10;
    } else if (planType === 'pro' || planType === 'unlimited') {
      allowedLimit = Infinity; // Aucune restriction
    }

    if (currentResellerCount >= allowedLimit) {
      logger.warn({ companyId, planType, currentResellerCount }, '[SaaS LOCK] Seuil critique de revendeurs atteint.');
      res.status(403).json({ 
        error: `Votre plan '${planType.toUpperCase()}' est limité à ${allowedLimit} revendeurs au maximum. Veuillez mettre à niveau votre abonnement pour débloquer de nouveaux accès.` 
      });
      return;
    }

    // 4. Si les quotas sont respectés, procéder à la double écriture transactionnelle standard
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await db.query('BEGIN');

    await db.query(
      `INSERT INTO resellers (company_id, name, email, password_hash, phone, deposit_name) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [companyId, firstName + ' ' + lastName, email, passwordHash, phone, deposit_name]
    );

    await db.query(
      `INSERT INTO users (company_id, first_name, last_name, email, password_hash, role) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [companyId, firstName, lastName, email, passwordHash, 'RESELLER']
    );

    await db.query('COMMIT');
    logger.info({ email, companyId }, '[AUTH] Revendeur et accès utilisateur créés avec succès.');

    res.status(201).json({ message: 'Revendeur créé avec succès et accès généré.' });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error("ERREUR DÉTAILLÉE LORS DE LA CRÉATION RESELLER :", error);
    res.status(500).json({ error: 'Erreur lors de la création du revendeur.' });
  }
};
// --- AJOUT : RÉCUPÉRATION DES INFOS DE L'ENTREPRISE (ESSAI / PLAN) ---
export const getCompanyById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const companyQuery = await db.query(
      'SELECT id, name, country, plan_type, chosen_plan, is_premium, currency, trial_ends_at FROM companies WHERE id = $1',
      [id]
    );

    if (companyQuery.rowCount === 0) {
      res.status(404).json({ error: 'Entreprise introuvable.' });
      return;
    }

    // On renvoie directement l'objet de l'entreprise
    res.status(200).json(companyQuery.rows[0]);
  } catch (error) {
    logger.error(error, '[COMPANY FETCH ERROR] Échec de la récupération des données de l\'entreprise');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
};