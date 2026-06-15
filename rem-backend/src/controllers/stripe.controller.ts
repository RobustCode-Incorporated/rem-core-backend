import { Request, Response } from 'express';
import Stripe from 'stripe';
import { db } from '../config/db';
import pino from 'pino';

const logger = pino({ transport: { target: 'pino-pretty' } });

// Initialisation de Stripe avec la version Dahlia validée sur ton dashboard
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia' as any,
});

const ENDPOINT_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

// Mapping propre entre tes Price IDs Stripe et les types de plan en BDD
const PLAN_MAPPING: Record<string, string> = {
  [process.env.STRIPE_PRICE_ENTREE!]: 'entrée',
  [process.env.STRIPE_PRICE_STANDARD!]: 'standard',
  [process.env.STRIPE_PRICE_PRO!]: 'pro',
};

// 💳 1. Création de la session d'essai 30 jours (Stripe Checkout)
export const createCheckoutSession = async (req: Request, res: Response): Promise<void> => {
  // @ts-ignore
  const { companyId } = req.user; 
  const { planPriceId } = req.body;

  try {
    // Vérification si l'utilisateur a un accès illimité (Bypass CEO)
    const companyCheck = await db.query('SELECT plan_type FROM companies WHERE id = $1', [companyId]);
    if (companyCheck.rows[0]?.plan_type === 'unlimited') {
      res.status(400).json({ error: "Vous bénéficiez déjà d'un accès illimité administrateur." });
      return;
    }

    const frontendBaseUrl = (process.env.FRONTEND_URL || 'https://rem-core-frontend.vercel.app').replace(/\/$/, '');
    
    // Détermination du plan choisi pour le transmettre au frontend
    const planType = PLAN_MAPPING[planPriceId] || 'entrée';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: planPriceId, quantity: 1 }],
      mode: 'subscription',
      
      // Liaison indispensable pour que le webhook sache quelle entreprise a payé
      client_reference_id: companyId.toString(),
      
      // Configuration des 30 jours gratuits
      subscription_data: {
        trial_period_days: 30,
      },
      
      // 🎯 AJOUT ICI : On passe le plan choisi dans l'URL de redirection
      success_url: `${frontendBaseUrl}/dashboard?status=success&chosen_plan=${planType}`,
      cancel_url: `${frontendBaseUrl}/billing?status=cancel`,
      metadata: { companyId: companyId.toString() },
    });

    res.json({ url: session.url });
  } catch (error: any) {
    logger.error(error, '[STRIPE CHECKOUT ERROR] Échec de création de session');
    res.status(500).json({ error: error.message });
  }
};

// 📡 2. Le Webhook Stripe qui écoute 'checkout.session.completed'
export const handleStripeWebhook = async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    res.status(400).send('Header Stripe-Signature manquant.');
    return;
  }

  let event: any;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, ENDPOINT_SECRET);
  } catch (err: any) {
    logger.error(`[STRIPE WEBHOOK ERROR] Signature invalide : ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;

    const companyId = session.client_reference_id;
    const stripeSubscriptionId = session.subscription as string;
    
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    const priceId = lineItems.data[0]?.price?.id;

    if (!companyId || !priceId) {
      logger.error('[STRIPE WEBHOOK] Métadonnées introuvables dans la session.');
      res.status(400).send('Données de session incomplètes.');
      return;
    }

    const planType = PLAN_MAPPING[priceId] || 'entrée';

    try {
      await db.query(
        `UPDATE companies 
         SET plan_type = $1, 
             stripe_subscription_id = $2, 
             is_premium = true,
             updated_at = NOW() 
         WHERE id = $3`,
        [planType, stripeSubscriptionId, companyId]
      );

      logger.info(`[STRIPE] Compagnie ${companyId} synchronisée sur le plan : ${planType.toUpperCase()} (is_premium: TRUE)`);
    } catch (error) {
      logger.error(error, `[STRIPE BDD ERROR] Erreur lors de l'upgrade de la compagnie ${companyId}`);
      res.status(500).send('Erreur interne BDD');
      return;
    }
  }

  res.status(200).json({ received: true });
};

// ❌ 3. Annulation Stripe + Suppression Définitive de la Base de Données
export const deleteCompanyAccount = async (req: Request, res: Response): Promise<void> => {
  // @ts-ignore
  const { companyId } = req.user;

  try {
    const companyQuery = await db.query('SELECT stripe_subscription_id, plan_type FROM companies WHERE id = $1', [companyId]);
    
    if (!companyQuery.rows[0]) {
      res.status(404).json({ error: "Entreprise introuvable." });
      return;
    }

    const { stripe_subscription_id, plan_type } = companyQuery.rows[0];

    if (plan_type === 'unlimited') {
      res.status(403).json({ error: "Action interdite : Le compte SuperAdmin ne peut pas être supprimé." });
      return;
    }

    if (stripe_subscription_id) {
      await stripe.subscriptions.cancel(stripe_subscription_id);
      logger.info({ stripe_subscription_id }, '[STRIPE] Abonnement résilié avec succès.');
    }

    await db.query('DELETE FROM companies WHERE id = $1', [companyId]);
    logger.info({ companyId }, '[BDD] Espace REM entièrement nettoyé.');

    res.json({ message: "Abonnement résilié et espace REM intégralement supprimé." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};