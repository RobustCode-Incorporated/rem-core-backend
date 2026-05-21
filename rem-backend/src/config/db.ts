import { Pool } from 'pg';
import dotenv from 'dotenv';
import pino from 'pino';

dotenv.config();

const logger = pino({ transport: { target: 'pino-pretty' } });

// Initialisation du pool de connexion vers Neon.tech
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true, // Requis pour les connexions sécurisées Neon
  },
});

pool.on('connect', () => {
  logger.info('[DATABASE] Nouvelle connexion établie avec Neon PostgreSQL');
});

pool.on('error', (err) => {
  logger.error('[DATABASE] Erreur inattendue sur le pool de connexion', err);
});

export const db = {
  query: (text: string, params?: any[]) => {
    logger.info({ sql: text, params }, '[SQL EXECUTION]');
    return pool.query(text, params);
  },
  // Ajout de la méthode de fermeture pour nettoyer les processus Jest
  end: () => {
    logger.info('[DATABASE] Fermeture du pool de connexion');
    return pool.end();
  }
};