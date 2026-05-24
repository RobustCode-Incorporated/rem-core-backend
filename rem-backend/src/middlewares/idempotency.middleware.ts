import { Request, Response, NextFunction } from 'express';
import { SalesModel } from '../models/sales.model';

export async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  // 1. Récupérer la clé d'idempotence dans les headers (insensible à la casse)
  const idempotencyKey = req.headers['x-idempotency-key'] as string;

  // Si aucune clé n'est fournie, on continue normalement
  if (!idempotencyKey) {
    return next();
  }

  try {
    // 2. Vérifier si cette clé a déjà été traitée par le passé
    const cachedResponse = await SalesModel.getIdempotencyRecord(idempotencyKey);

    if (cachedResponse) {
      // 🎯 SÉCURITÉ : La clé existe ! On renvoie directement la réponse d'origine
      res.status(cachedResponse.status).json(cachedResponse.body);
      return;
    }

    // 3. La clé est nouvelle. On intercepte la méthode d'envoi d'Express pour sauvegarder le résultat final
    const originalJson = res.json;

    res.json = function (body: any): Response {
      // On restaure la fonction originale pour ne pas perturber Express
      res.json = originalJson;

      // On extrait le statut HTTP actuel (par exemple 201 Created)
      const statusCode = res.statusCode;

      // Sauvegarde asynchrone en arrière-plan dans Neon
      SalesModel.saveIdempotencyRecord(idempotencyKey, statusCode, body)
        .catch((err) => console.error(`[Idempotency] Erreur lors de la sauvegarde de la clé ${idempotencyKey}:`, err));

      // On distribue la réponse à l'utilisateur
      return originalJson.call(this, body);
    };

    next();
  } catch (error) {
    console.error('[Idempotency] Erreur critique lors de la vérification de la clé:', error);
    res.status(500).json({ error: 'Internal Server Error durante la validación de idempotencia' });
  }
}