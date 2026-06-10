import { db } from '../config/db';
import { v4 as uuidv4 } from 'uuid';

export const runDataSimulation = async (companyId: string) => {
  console.log("🚀 [HIGH-VOLUME DATA ENGINEERING] Initialisation de la simulation massive...");
  console.time("⏱️ Durée totale de la simulation");

  try {
    // ==========================================
    // 1. NETTOYAGE DES ANCIENNES DONNÉES
    // ==========================================
    await db.query(`DELETE FROM document_items`);
    await db.query(`DELETE FROM documents WHERE company_id = $1`, [companyId]);
    await db.query(`DELETE FROM clients WHERE company_id = $1`, [companyId]);
    await db.query(`DELETE FROM products WHERE company_id = $1`, [companyId]);
    await db.query(`DELETE FROM resellers WHERE company_id = $1`, [companyId]);
    
    console.log("🧹 [CLEANUP] Tables purgées pour l'entreprise cible.");

    // ==========================================
    // 2. GÉNÉRATION DE 100 REVENDEURS (BRUXELLES & ALENTOURS)
    // ==========================================
    console.log("🛰️ Génération des 100 revendeurs géolocalisés...");
    const baseLat = 50.8503;
    const baseLng = 4.3517;
    const fakeHash = '$2b$10$xyzFakeHashForMobileConnectionDoNotUseInProd';

    for (let i = 1; i <= 100; i++) {
      const id = uuidv4();
      const randomLat = baseLat + (Math.random() - 0.5) * 0.4; // Rayon étendu pour 100 points
      const randomLng = baseLng + (Math.random() - 0.5) * 0.6;
      const name = `Partner Reseller N°${String(i).padStart(3, '0')}`;
      const deposit = `Dépôt Régional ${String.fromCharCode(65 + (i % 26))}${i}`;
      const email = `reseller.${i}@robustcode-network.com`;
      const phone = `+32 499 ${Math.floor(100000 + Math.random() * 900000)}`;

      await db.query(`
        INSERT INTO resellers (id, company_id, name, email, password_hash, phone, deposit_name, latitude, longitude, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [id, companyId, name, email, fakeHash, phone, deposit, randomLat, randomLng]);
    }
    console.log("✅ 100 revendeurs insérés en base de données.");

    // ==========================================
    // 3. CATALOGUE PRODUITS (Ajusté pour atteindre le Milliard)
    // ==========================================
    // Pour atteindre 1 milliard de CA avec 5000 ventes, on introduit des produits à forte valeur nominale
    const productsData = [
      { name: 'Infrastructure Cloud Entreprise XL', sku: 'INFRA-XL', barcode: '999001', purchase: 150000.0, selling: 250000.0, stock: 10000 },
      { name: 'Module Licence REM Core Pro', sku: 'LIC-REM-PRO', barcode: '999002', purchase: 45000.0, selling: 75000.0, stock: 25000 },
      { name: 'Terminal Matériel Robuste Hub', sku: 'HARD-HUB', barcode: '999003', purchase: 8000.0, selling: 12500.0, stock: 50000 },
      { name: 'Support Technique & Maintenance Annuelle', sku: 'SUP-ANNUAL', barcode: '999004', purchase: 2000.0, selling: 4500.0, stock: 99999 }
    ];

    const createdProducts: Array<{ id: string, name: string, price: number }> = [];

    for (const prod of productsData) {
      const productId = uuidv4();
      await db.query(`
        INSERT INTO products (id, company_id, name, sku, barcode, stock_quantity, min_stock_alert, purchase_price, selling_price, currency, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, 10, $7, $8, 'USD', NOW())
      `, [productId, companyId, prod.name, prod.sku, prod.barcode, prod.stock, prod.purchase, prod.selling]);

      createdProducts.push({ id: productId, name: prod.name, price: prod.selling });
    }
    console.log("📦 Catalogue de produits Haute Valeur initialisé.");

    // ==========================================
    // 4. INJECTION DES CLIENTS (20 Grands Comptes)
    // ==========================================
    const clientIds: string[] = [];
    for (let i = 1; i <= 20; i++) {
      const clientId = uuidv4();
      const name = `Corporate Client Enterprise Corp 0${i}`;
      const email = `contact@corporate0${i}.com`;
      const phone = `+32 2 ${Math.floor(1000000 + Math.random() * 9000000)}`;

      await db.query(`
        INSERT INTO clients (id, company_id, name, phone, email, address, created_at)
        VALUES ($1, $2, $3, $4, $5, 'Zone Industrielle Hub, Bruxelles', NOW())
      `, [clientId, companyId, name, phone, email]);
      
      clientIds.push(clientId);
    }
    console.log("👤 20 clients Grands Comptes créés.");

    // ==========================================
    // 5. BLOCKCHAIN SIMULATION : GÊNÉRE DE 5200 VENTES OBLIGATOIRES
    // ==========================================
    console.log("💸 Initialisation du moteur de facturation de masse (> 5000 ventes)...");
    
    const TOTAL_SALES_TO_GENERATE = 5200;
    let accumulatedPaidVolume = 0;
    let paidInvoicesCount = 0;
    let draftInvoicesCount = 0;
    let cancelledInvoicesCount = 0;

    // Pour exécuter rapidement, on va faire des transactions par blocs (Chunks)
    // Chaque vente génère 1 document et 1 document_item associé
    for (let i = 1; i <= TOTAL_SALES_TO_GENERATE; i++) {
      const documentId = uuidv4();
      const randomClientId = clientIds[Math.floor(Math.random() * clientIds.length)];
      const randomProduct = createdProducts[Math.floor(Math.random() * createdProducts.length)];
      
      // Distribution réaliste des quantités (ex: entre 1 et 4 unités)
      const quantitySold = Math.floor(Math.random() * 4) + 1;
      const totalAmount = randomProduct.price * quantitySold;
      const invoiceNumber = `INV-2026-${String(i).padStart(5, '0')}`;

      // Détermination aléatoire du statut
      // 85% PAID, 10% DRAFT, 5% CANCELLED
      const randStatus = Math.random();
      let status = 'PAID';
      if (randStatus > 0.85 && randStatus <= 0.95) {
        status = 'DRAFT';
        draftInvoicesCount++;
      } else if (randStatus > 0.95) {
        status = 'CANCELLED';
        cancelledInvoicesCount++;
      } else {
        status = 'PAID';
        paidInvoicesCount++;
        accumulatedPaidVolume += totalAmount;
      }

      // Insertion du Document de vente
      await db.query(`
        INSERT INTO documents (id, company_id, client_id, type, number, status, total_amount, created_at, updated_at)
        VALUES ($1, $2, $3, 'INVOICE', $4, $5, $6, NOW(), NOW())
      `, [documentId, companyId, randomClientId, invoiceNumber, status, totalAmount]);

      // Insertion de l'Item associé
      await db.query(`
        INSERT INTO document_items (id, document_id, product_id, quantity, unit_price, total_price)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [uuidv4(), documentId, randomProduct.id, quantitySold, randomProduct.price, totalAmount]);

      // Si la facture est payée, on déduit le stock physique
      if (status === 'PAID') {
        await db.query(`
          UPDATE products 
          SET stock_quantity = stock_quantity - $1
          WHERE company_id = $2 AND id = $3
        `, [quantitySold, companyId, randomProduct.id]);
      }

      // Log d'avancement tous les 1000 inserts pour suivre l'état du terminal
      if (i % 1000 === 0) {
        console.log(`⏳ Progression : ${i} / ${TOTAL_SALES_TO_GENERATE} documents générés...`);
      }
    }

    console.log("--------------------------------------------------");
    console.log("📊 RAPPORT METRIC DE SIMULATION DU LEAD ENGINEER :");
    console.log(`🔹 Total de documents créés: ${TOTAL_SALES_TO_GENERATE}`);
    console.log(`✅ Factures au statut PAID   : ${paidInvoicesCount}`);
    console.log(`📝 Factures au statut DRAFT  : ${draftInvoicesCount}`);
    console.log(`❌ Factures au statut CANCELLED: ${cancelledInvoicesCount}`);
    console.log(`💰 CHIFFRE D'AFFAIRES CIBLE (PAID) : ${accumulatedPaidVolume.toLocaleString('fr-FR', { style: 'currency', currency: 'USD' })}`);
    console.log("--------------------------------------------------");

    console.timeEnd("⏱️ Durée totale de la simulation");
  } catch (error) {
    console.error("❌ [CRITICAL MASS ERROR] Échec du traitement haute capacité :", error);
    throw error;
  }
};