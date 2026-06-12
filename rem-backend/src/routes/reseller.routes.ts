import { Router } from 'express';
import { requestRestock } from '../controllers/restock.controller';
import { 
  getResellersLiveLocation, 
  getResellerPerformance,
  createResellerWithAccess,
  getMyStock // Import propre
} from '../controllers/resellers.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

/**
 * 🎯 Route corrigée pour correspondre à l'appel du frontend :
 * Frontend appelle : /api/resellers/me/stock
 * Définition ici : /me/stock (car le routeur est préfixé par /api/resellers)
 */
router.get('/me/stock', requireAuth, getMyStock);

router.post('/create-with-access', requireAuth, createResellerWithAccess);
router.post('/restock-request', requireAuth, requestRestock);

router.get('/', requireAuth, getResellersLiveLocation);
router.get('/live-location', requireAuth, getResellersLiveLocation);
router.get('/:id/performance', requireAuth, getResellerPerformance);

export const resellerRouter = router;