import { Router } from 'express';
import { getRoute } from '../controllers/route.controller';

const router = Router();

/**
 * @route   GET /api/route
 * @desc    Itinéraire routier (OSRM) entre 2 points ou plus — utilisé par le
 *          globe de logistique (prototype) via gods-eye-view/search.
 * @access  Public (aucune donnée sensible, comme les autres proxys géo de GEV)
 */
router.get('/', getRoute);

export const routeRouter = router;
