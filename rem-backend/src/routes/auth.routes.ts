import { Router } from 'express';
import { registerCompanyAndUser, loginUser, getCompanyById } from '../controllers/auth.controller'; 
import { requireAuth } from '../middlewares/auth.middleware'; 
import { db } from '../config/db'; // Instance de connexion SQL brut

const router = Router();

/**
 * @route   POST /api/auth/register
 * @access  Public
 */
router.post('/register', registerCompanyAndUser);

/**
 * @route   POST /api/auth/login
 * @access  Public
 */
router.post('/login', loginUser); 

/**
 * @route   GET /api/auth/companies/:id
 * @access  Protégé
 */
router.get('/companies/:id', requireAuth, getCompanyById); 

/**
 * @route   DELETE /api/auth/companies/danger-delete
 * @desc    Purge absolue et définitive de l'espace PME (Multi-tenant)
 * @access  Protégé
 */
router.delete('/companies/danger-delete', requireAuth, async (req, res) => {
  // Interconnexion ACID serverless friendly via un client dédié du pool
  const client = await db.connect();

  try {
    const companyId = req.user?.companyId; 

    if (!companyId) {
      return res.status(400).json({ error: "Impossible d'identifier votre entreprise depuis la session." });
    }

    // Début de la transaction sécurisée
    await client.query('BEGIN');

    // 1. Nettoyage de 'reseller_stocks' (Dépend de users et products)
    // On cible via les utilisateurs rattachés à cette PME
    await client.query(`
      DELETE FROM reseller_stocks 
      WHERE reseller_id IN (SELECT id FROM users WHERE company_id = $1);
    `, [companyId]);

    // 2. Nettoyage de 'document_items' (Contrainte RESTRICT sur les produits)
    // On supprime les lignes d'articles liées aux factures/documents de la PME
    await client.query(`
      DELETE FROM document_items 
      WHERE document_id IN (SELECT id FROM documents WHERE company_id = $1);
    `, [companyId]);

    // 3. Suppression des documents principaux (Factures, Devis, Restocks)
    await client.query(`DELETE FROM documents WHERE company_id = $1;`, [companyId]);

    // 4. Suppression des revendeurs (Table resellers)
    await client.query(`DELETE FROM resellers WHERE company_id = $1;`, [companyId]);

    // 5. Suppression des produits (Désormais libres de toute liaison restreinte)
    await client.query(`DELETE FROM products WHERE company_id = $1;`, [companyId]);

    // 6. Suppression des utilisateurs (Commerciaux, staffs, admins de la PME)
    await client.query(`DELETE FROM users WHERE company_id = $1;`, [companyId]);

    // 7. Clôture finale : Suppression de la ligne parente de l'entreprise
    await client.query(`DELETE FROM companies WHERE id = $1;`, [companyId]);

    // Validation définitive de la transaction en cascade
    await client.query('COMMIT');

    console.log(`[DANGER ZONE SUCCESS] PME ID ${companyId} et toutes ses dépendances (resellers, stocks, items) ont été définitivement purgées.`);
    
    return res.status(200).json({ 
      message: "Votre espace entreprise ainsi que l'ensemble de vos données d'inventaire et de vente ont été supprimés définitivement." 
    });

  } catch (error) {
    // En cas de moindre accroc ou table verrouillée, on annule tout pour éviter de corrompre la BDD
    await client.query('ROLLBACK');
    console.error("🚨 [CRITICAL ERROR] Échec de la purge de l'entreprise :", error);
    return res.status(500).json({ error: "Une erreur interne est survenue sur le serveur lors de la suppression." });
  } finally {
    // Libération immédiate du slot de connexion vers le pool Neon
    client.release();
  }
});

export const authRouter = router;
