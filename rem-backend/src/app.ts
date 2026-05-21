import express, { Request, Response, NextFunction } from 'express';
import pino from 'pino';
import { db } from './config/db';
import { salesRouter } from './routes/sales.routes';

const logger = pino({ transport: { target: 'pino-pretty' } });
const app = express();

app.use(express.json());

// Middleware de Log des requêtes HTTP
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info({ method: req.method, url: req.url }, 'Requête HTTP entrante');
  next();
});
app.use('/api/sales', salesRouter);

// Endpoint de diagnostic de santé (Healthcheck)
app.get('/health', async (req: Request, res: Response) => {
  try {
    // Test rapide de la connexion Neon
    await db.query('SELECT NOW()');
    res.status(200).json({ status: 'UP', database: 'CONNECTED', timestamp: new Date() });
  } catch (error) {
    logger.error(error, 'Erreur lors du healthcheck');
    res.status(500).json({ status: 'DOWN', error: 'Database connection failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`[SERVER] Le REM Core tourne sur le port ${PORT}`);
});