import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { AnalyticsController } from '../controllers/analytics.controller';
import { AnalyticsRepository } from '../repositories/analytics.repository';
// On importe tout le module de configuration de la DB
import * as dbModule from '../config/db'; 

const router = Router();

// 🕵️‍♂️ ALGORITHME D'AUTO-DÉTECTION DU POOL
let pool: any = null;

if (dbModule) {
  // 1. Vérification des patterns d'exports les plus fréquents
  if ((dbModule as any).pool && typeof (dbModule as any).pool.query === 'function') {
    pool = (dbModule as any).pool;
  } else if ((dbModule as any).default && typeof (dbModule as any).default.query === 'function') {
    pool = (dbModule as any).default;
  } else if (typeof (dbModule as any).query === 'function') {
    pool = dbModule;
  } else {
    // 2. Scan dynamique de secours : on extrait le premier objet qui possède la méthode .query
    const keys = Object.keys(dbModule);
    for (const key of keys) {
      const exportItem = (dbModule as any)[key];
      if (exportItem && typeof exportItem.query === 'function') {
        pool = exportItem;
        console.log(`🔍 [REM INFO] Connexion détectée automatiquement via l'export : "${key}"`);
        break;
      }
    }
  }
}

// Alerte de sécurité si le fichier de configuration est vide ou mal mappé
if (!pool) {
  console.error("🚨 [REM CRITICAL] Impossible de trouver l'instance de connexion dans ../config/db. Clés disponibles :", Object.keys(dbModule));
}

// Injection du pool détecté
const repository = new AnalyticsRepository(pool);
const controller = new AnalyticsController(repository);

// Routage avec préservation du scope 'this'
router.get('/products', requireAuth, (req, res) => controller.getProductAnalytics(req, res));

export default router;