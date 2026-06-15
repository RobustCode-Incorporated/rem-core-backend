import express from 'express';
import Stripe from 'stripe';
import { db } from '../config/db';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-24' as any });

router.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res): Promise<void> => {
  const sig = req.headers['stripe-signature']!;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Événement déclenché lorsque l'inscription à la période d'essai est validée
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const companyId = session.metadata?.companyId;
    const subscriptionId = session.subscription as string;

    if (companyId) {
      try {
        // 🔍 Récupération sécurisée des articles de la session pour obtenir l'ID du prix exact
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        const priceId = lineItems.data[0]?.price?.id;

        // 🎯 Mapping entre l'ID Stripe récupéré et ton label de colonne plan_type
        let planLabel = 'entrée'; // Valeur par défaut de sécurité

        // Tu peux directement lier tes IDs de test Stripe ici ou via tes variables d'environnement (recommandé)
        if (priceId === process.env.STRIPE_PRICE_STANDARD || priceId === 'price_STANDARD_ID') {
          planLabel = 'standard';
        } else if (priceId === process.env.STRIPE_PRICE_PRO || priceId === 'price_PRO_ID') {
          planLabel = 'pro';
        } else if (priceId === process.env.STRIPE_PRICE_ENTREE || priceId === 'price_ENTREE_ID') {
          planLabel = 'entrée';
        }

        // 📝 Mise à jour chirurgicale de la base de données Neon
        await db.query(
          `UPDATE companies 
           SET stripe_subscription_id = $1, 
               plan_type = $2, 
               is_premium = TRUE, 
               trial_ends_at = NOW() + INTERVAL '30 days' 
           WHERE id = $3`,
          [subscriptionId, planLabel, companyId]
        );

        console.log(`[Stripe Webhook] Abonnement d'essai de 30 jours activé pour le plan: ${planLabel} (Entreprise: ${companyId})`);
      } catch (error: any) {
        console.error(`[Stripe Webhook Error] Erreur lors du traitement interne: ${error.message}`);
        res.status(500).send(`Internal Webhook Server Error: ${error.message}`);
        return;
      }
    }
  }

  res.json({ received: true });
});

export default router;