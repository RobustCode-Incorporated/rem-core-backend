import { Router } from 'express';
import { validateRestock, getDocumentItems } from '../controllers/restock.controller';
import { 
  createSalesDocument, 
  createClient, 
  updateDocumentStatus, 
  syncOfflineDocument,
  getSalesDocuments,
  processRetailCheckout // 👈 Importation de la nouvelle méthode de caisse
} from '../controllers/sales.controller';
import { 
  getResellersLiveLocation, 
  getResellerPerformance 
} from '../controllers/resellers.controller'; 
import { requireAuth } from '../middlewares/auth.middleware'; 
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware'; 

const router = Router();

/**
 * @route   GET /api/sales/resellers-location
 * @desc    Extraction cartographique synchrone multi-critères des revendeurs (Nom, Email, Dépôt, Tél)
 * @access  Protégé (Requiert une session active et un Token JWT valide)
 */
router.get('/resellers-location', requireAuth, getResellersLiveLocation);

/**
 * @route   GET /api/sales/resellers/:id/performance
 * @desc    Tableau de bord financier agrégé et analytique d'un revendeur ciblé (Performance Pro)
 * @access  Public / Dev (Idéal pour l'intégration de la Sidebar Frontend)
 */
router.get('/resellers/:id/performance', getResellerPerformance);

/**
 * @route   GET /api/sales/documents
 * @desc    Liste des documents de vente avec pagination, filtres et recherche dynamique
 * @access  Protégé (Requiert une session active et un Token JWT valide)
 */
router.get('/documents', requireAuth, getSalesDocuments); 

/**
 * @route   GET /api/sales/documents/:id/items
 * @desc    Extraction exhaustive des lignes d'articles associées à un document commercial (Vente ou Restock)
 * @access  Protégé (Requiert une session active et un Token JWT valide)
 */
router.get('/documents/:id/items', requireAuth, getDocumentItems);

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
 * @route   POST /api/sales/retail-checkout
 * @desc    Encaissement direct et déduction de stock immédiate depuis la caisse QuickSale.vue
 * @access  Protégé (Requiert une session active et un Token JWT valide)
 */
router.post('/retail-checkout', requireAuth, processRetailCheckout);

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

/**
 * @route   PUT /api/sales/restock/validate/:id
 * @desc    Validation admin : Valide le paiement et gère le transfert croisé de stocks
 * @access  Protégé (Requiert une session active et un Token JWT valide)
 */
router.put('/restock/validate/:id', requireAuth, validateRestock);
router.put('/documents/:id', updateDocumentStatus);

export const salesRouter = router;