import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Accès non autorisé. Token manquant.' });
    return;
  }

  const token = authHeader.split(' ')[1];

  // 🛠️ BYPASS DE SÉCURITÉ POUR LA SIMULATION MOBILE (DEV MODE)
  // Si le token correspond à notre token de test, on injecte manuellement l'utilisateur de simulation
  if (token.startsWith('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')) {
    (req as any).user = {
      id: 'user-uuid-999',
      email: 'test@boutique.sn',
      companyId: 'bf30cd12-9c1d-4074-b4a0-000000000000',
      role: 'ADMIN'
    };
    return next();
  }

  // Logique standard de vérification (ton code actuel)
  try {
    const secret = process.env.JWT_SECRET || 'fallback_secret';
    const decoded = jwt.verify(token, secret);
    (req as any).user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Token invalide ou expiré.' });
  }
};