import { Router } from 'express';
import { createSalesDocument, createClient, updateDocumentStatus } from '../controllers/sales.controller';
import { requireAuth } from '../middlewares/auth.middleware'; // Notre verrou de sécurité

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
router.post('/clients', requireAuth, createClient); // <-- Corrigé ici avec requireAuth !

// Route pour encaisser ou changer le statut d'un document
router.patch('/documents/:id/status', requireAuth, updateDocumentStatus);

export const salesRouter = router;