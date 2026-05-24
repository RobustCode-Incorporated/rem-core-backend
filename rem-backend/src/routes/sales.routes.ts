import { Router } from 'express';
import { 
  createSalesDocument, 
  createClient, 
  updateDocumentStatus, 
  syncOfflineDocument 
} from '../controllers/sales.controller';
import { requireAuth } from '../middlewares/auth.middleware'; // Notre verrou de sécurité
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware'; // Le bouclier anti-doublons

const router = Router();

/**
 * @route   POST /api/sales/documents
 * @desc    Création d'un devis ou d'une facture multi-tenant sécurisée
 * @access  Protégé (Requiert une session active et un Token JWT valide)
 */
router.post('/documents', requireAuth, createSalesDocument);

/**
 * @route   POST /api/sales/clients
 * @desc    Création d'un client rattaché à l'entreprise (Multi-tenant)
 * @access  Protégé (Requiert une session active et un Token JWT valide)
 */
router.post('/clients', requireAuth, createClient);

/**
 * @route   PATCH /api/sales/documents/:id/status
 * @desc    Encaisser ou changer le statut d'un document commercial
 * @access  Protégé (Requiert une session active et un Token JWT valide)
 */
router.patch('/documents/:id/status', requireAuth, updateDocumentStatus);

/**
 * @route   POST /api/sales/sync
 * @desc    Synchronisation Offline-First depuis l'application mobile (Gère l'idempotence)
 * @access  Protégé (Requiert Token JWT valide + clé d'idempotence X-Idempotency-Key dans les headers)
 */
router.post('/sync', requireAuth, idempotencyMiddleware, syncOfflineDocument);

export const salesRouter = router;