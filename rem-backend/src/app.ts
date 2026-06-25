import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors'; 
import pino from 'pino';
import { db } from './config/db';
import { salesRouter } from './routes/sales.routes';
import { authRouter } from './routes/auth.routes';
import { resellerRouter } from './routes/reseller.routes';
import analyticsRoutes from './routes/analytics.routes';

// Import des contrôleurs Stripe
import { createCheckoutSession, handleStripeWebhook, deleteCompanyAccount } from './controllers/stripe.controller';

// IMPORT MIDDLEWARE D'AUTHENTIFICATION HARMONISÉ
import { requireAuth } from './middlewares/auth.middleware'; 

const logger = pino({ transport: { target: 'pino-pretty' } });
const app = express();

// Configuration CORS stricte pour la production REM
app.use(cors({
  origin: [
    'https://rem-core-frontend.vercel.app',
    'https://rem-core-frontend-robust-codes-projects.vercel.app', 
    'http://localhost:5173'                                       
  ], 
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key', 'Stripe-Signature'],
  credentials: true,
  optionsSuccessStatus: 200
}));

app.options('*', cors());

// RÈGLE D'OR STRIPE : La route Webhook doit intercepter le RAW body.
// Elle se place donc impérativement AVANT app.use(express.json())
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);
// Toutes les routes définies après cette ligne intercepteront du JSON standard
app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info({ method: req.method, url: req.url }, 'Requête HTTP entrante');
  next();
});

// Aiguillage des modules applicatifs
app.use('/api/sales', salesRouter); 
app.use('/api/auth', authRouter);
app.use('/api/resellers', resellerRouter); 
app.use('/api/analytics', analyticsRoutes);

// 💳 Routes de Facturation & Abonnements Stripe sécurisées
// L'injection de requireAuth permet d'alimenter correctement req.user pour le contrôleur !
app.post('/api/stripe/checkout', requireAuth, createCheckoutSession);
app.delete('/api/stripe/cancel-account', requireAuth, deleteCompanyAccount);

// Récupération du catalogue produits
app.get('/api/products', async (req: Request, res: Response): Promise<void> => {
  const companyId = req.query.company_id as string;
  if (!companyId) { res.status(400).json({ error: 'Le paramètre company_id est obligatoire.' }); return; }

  try {
    const result = await db.query(
      'SELECT id, name, purchase_price, selling_price, stock_quantity, min_stock_alert, currency, created_at FROM products WHERE company_id = $1 ORDER BY name ASC', 
      [companyId]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    logger.error(error, 'Erreur lors de la récupération des produits');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Création d'un produit
app.post('/api/products', async (req: Request, res: Response): Promise<void> => {
  const { name, purchasePrice, sellingPrice, stockQuantity, minStockAlert, currency, company_id } = req.body;

  try {
    const result = await db.query(
      `INSERT INTO products (name, purchase_price, selling_price, stock_quantity, min_stock_alert, currency, company_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, purchasePrice, sellingPrice, stockQuantity, minStockAlert, currency, company_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error(error, 'Erreur lors de la création du produit');
    res.status(500).json({ error: 'Erreur interne lors de la création.' });
  }
});

// Récupération des ventes
app.get('/api/sales', async (req: Request, res: Response): Promise<void> => {
  const companyId = req.query.company_id as string;
  if (!companyId) { res.status(400).json({ error: 'Le paramètre company_id est obligatoire.' }); return; }

  try {
    const result = await db.query(
      'SELECT id, client_id, type, number, status, total_amount, created_at FROM documents WHERE company_id = $1 ORDER BY created_at DESC', 
      [companyId]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    logger.error(error, 'Erreur lors de la récupération des ventes');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

app.get('/health', async (req: Request, res: Response) => {
  try {
    await db.query('SELECT NOW()');
    res.status(200).json({ status: 'UP', database: 'CONNECTED' });
  } catch (error) {
    res.status(500).json({ status: 'DOWN', error: 'Database connection failed' });
  }
});

// 🛡️ GESTIONNAIRE D'ERREURS GLOBAL (Anti-fausses erreurs CORS)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(err, '❌ [CRASH INTERNE SERVEUR]');
  res.status(500).json({ 
    error: 'Une erreur interne est survenue sur le serveur.',
    message: err.message 
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Le REM Core tourne sur le port ${PORT} et écoute le Webhook Stripe.`);
});
