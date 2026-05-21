import { Router } from 'express';
import { registerCompanyAndUser } from '../controllers/auth.controller';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Enregistre une nouvelle entreprise et son administrateur principal (Multi-tenant)
 * @access  Public
 */
router.post('/register', registerCompanyAndUser);

export const authRouter = router;