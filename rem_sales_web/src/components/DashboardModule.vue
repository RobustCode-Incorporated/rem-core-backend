<template>
  <div class="dashboard-module">
    <!-- Section Cartes / KPIs -->
    <div class="metrics-grid">
      <div class="metric-card">
        <h3>Ventes du Jour</h3>
        <p class="metric-value">{{ todaySalesTotal.toLocaleString() }} $</p>
      </div>
      <div class="metric-card">
        <h3>Commandes en attente</h3>
        <p class="metric-value">{{ pendingOrdersCount }}</p>
      </div>
      <div class="metric-card">
        <h3>Articles distincts en Stock</h3>
        <p class="metric-value">{{ stockList.length }}</p>
      </div>
    </div>

    <!-- 📦 NOUVEAU : L'inventaire réel disponible au magasin du revendeur -->
    <div class="inventory-section">
      <div class="section-header">
        <h2>📦 Mon Inventaire Magasin (Stocks Disponibles)</h2>
        <button @click="fetchResellerStock" class="refresh-btn">🔄 Actualiser</button>
      </div>

      <div v-if="stockLoading" class="loading-feedback">
        Analyse et synchronisation du stock magasin en cours...
      </div>

      <div v-else-if="stockList.length === 0" class="empty-stock-feedback">
        ⚠️ Aucun article en stock. Passez un bon de commande (Restock) pour alimenter votre dépôt.
      </div>

      <table v-else class="inventory-table">
        <thead>
          <tr>
            <th>ID Produit</th>
            <th>Désignation du Produit</th>
            <th class="text-center">Quantité Physique Dispo</th>
            <th>Statut Alerte</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in stockList" :key="item.product_id">
            <td class="font-mono font-bold">{{ item.product_id?.slice(0, 8) }}...</td>
            <td class="font-bold">{{ item.product_name || 'Produit REM' }}</td>
            <td class="text-center font-bold" :class="{ 'low-stock': item.quantity <= 5 }">
              {{ item.quantity }} pces
            </td>
            <td>
              <span v-if="item.quantity === 0" class="stock-badge out">Rupture</span>
              <span v-else-if="item.quantity <= 5" class="stock-badge alert">Alerte Seuil</span>
              <span v-else class="stock-badge ok">Optimal</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const todaySalesTotal = ref(0)
const pendingOrdersCount = ref(0)

const stockList = ref([])
const stockLoading = ref(false)

// 📥 Récupération du stock attribué au revendeur
const fetchResellerStock = async () => {
  stockLoading.value = true
  try {
    const token = localStorage.getItem('token')
    // Route adaptative ou fallback dynamique
    const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/resellers/me/stock`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    // Ajustement selon la structure de ta réponse BDD
    stockList.value = response.data.data || response.data
  } catch (error) {
    console.error("❌ Erreur lors du chargement de l'inventaire revendeur :", error)
  } finally {
    stockLoading.value = false
  }
}

// Extraction rapide des KPIs vitaux
const fetchKpis = async () => {
  try {
    const token = localStorage.getItem('token')
    const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/sales/documents`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit: 100 }
    })
    const docs = response.data.data || response.data
    
    // Calculs de surface réactifs
    if (Array.isArray(docs)) {
      pendingOrdersCount.value = docs.filter(d => d.type === 'RESTOCK_REQUEST' && d.status === 'DRAFT').length
      todaySalesTotal.value = docs
        .filter(d => d.status === 'PAID' && d.type === 'SALE')
        .reduce((acc, curr) => acc + Number(curr.total_amount), 0)
    }
  } catch (err) {
    console.error("Impossible de rafraîchir les KPIs", err)
  }
}

onMounted(() => {
  fetchKpis()
  fetchResellerStock()
})
</script>

<style scoped>
.dashboard-module { display: flex; flex-direction: column; gap: 30px; }
.metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.metric-card { background: #000; color: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.metric-card h3 { margin: 0 0 10px 0; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: #A0A0A0; }
.metric-value { margin: 0; font-size: 1.8rem; font-weight: bold; }

/* Styles Section Inventaire */
.inventory-section { background: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #e2e8f0; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.section-header h2 { font-size: 1.1rem; margin: 0; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
.refresh-btn { background: #000; color: #fff; border: none; padding: 6px 14px; border-radius: 4px; font-size: 0.8rem; cursor: pointer; }

.loading-feedback, .empty-stock-feedback { padding: 30px; text-align: center; color: #64748b; font-style: italic; font-size: 0.9rem; }

.inventory-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem; }
.inventory-table th { background: #f8fafc; color: #475569; font-weight: 600; padding: 12px; border-bottom: 2px solid #e2e8f0; }
.inventory-table td { padding: 12px; border-bottom: 1px solid #edf2f7; color: #1e293b; }

.font-mono { font-family: monospace; }
.font-bold { font-weight: bold; }
.text-center { text-align: center; }

.low-stock { color: #ef4444; background: #fee2e2; padding: 4px; border-radius: 4px; }

.stock-badge { padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; text-transform: uppercase; }
.stock-badge.ok { background: #d1fae5; color: #065f46; }
.stock-badge.alert { background: #fef3c7; color: #92400e; }
.stock-badge.out { background: #fee2e2; color: #991b1b; }
</style>