import { Router } from 'express';
import { registerCompanyAndUser, loginUser, getCompanyById } from '../controllers/auth.controller'; 
import { requireAuth } from '../middlewares/auth.middleware'; // 🔒 AJOUT : Protection de la route

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Enregistre une nouvelle entreprise et son administrateur principal (Multi-tenant)
 * @access  Public
 */
router.post('/register', registerCompanyAndUser);

/**
 * @route   POST /api/auth/login
 * @desc    Authentifie un utilisateur (commercial/admin) et retourne son Token JWT
 * @access  Public
 */
router.post('/login', loginUser); 

/**
 * @route   GET /api/auth/companies/:id
 * @desc    Récupère les informations d'abonnement et de décompte d'une entreprise
 * @access  Protégé
 */
router.get('/companies/:id', requireAuth, getCompanyById); // 🚀 AJOUT : Route de récupération des infos d'essai

export const authRouter = router;