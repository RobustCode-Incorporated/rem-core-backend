import { Router } from 'express';
import { createSalesDocument } from '../controllers/sales.controller';

const router = Router();

/**
 * @route   POST /api/sales/documents
 * @desc    Création d'un devis ou d'une facture multi-tenant avec calculs de prix automatisés
 * @access  Protégé (Requiert une session active)
 */
router.post('/documents', createSalesDocument);

export const salesRouter = router;
