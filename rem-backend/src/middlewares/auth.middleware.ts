import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    companyId: string;
    email?: string;
  };
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token manquant ou format invalide.' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    // Secret harmonisé avec le contrôleur
    const secret = process.env.JWT_SECRET || 'SuperSecretKeyREM2026!';
    const decoded = jwt.verify(token, secret as string) as any;
    
    // Extraction propre et typée du payload normalisé
    (req as AuthenticatedRequest).user = {
      id: decoded.id,
      companyId: decoded.companyId,
      role: decoded.role,
      email: decoded.email
    };
    
    next();
  } catch (error: any) {
    console.error("❌ ERREUR VERIF TOKEN :", error.message);
    res.status(403).json({ error: 'Token invalide ou expiré.' });
  }
};