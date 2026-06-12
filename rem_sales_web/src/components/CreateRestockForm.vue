<template>
  <div class="restock-container">
    <div class="header-section">
      <h2>🛒 Commander des Produits (Catalogue)</h2>
      <button @click="fetchProducts" class="refresh-btn">🔄 Actualiser Catalogue</button>
    </div>

    <div v-if="loading" class="loader">Chargement du catalogue...</div>

    <table v-else class="stock-table">
      <thead>
        <tr>
          <th>Produit</th>
          <th>Prix Unitaire</th>
          <th>Quantité à commander</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="prod in products" :key="prod.id">
          <td>
            <div class="prod-name">{{ prod.name }}</div>
            <small class="prod-desc">{{ prod.description || 'Aucune description' }}</small>
          </td>
          <td>{{ Number(prod.selling_price || 0).toLocaleString() }} {{ prod.currency }}</td>
          <td>
            <input 
              type="number" 
              v-model.number="orderQtys[prod.id]" 
              placeholder="0" 
              class="qty-input"
              min="0"
            />
          </td>
        </tr>
      </tbody>
    </table>

    <div class="footer-actions">
      <button 
        @click="submitRestock" 
        class="btn-order" 
        :disabled="isSubmitting"
      >
        {{ isSubmitting ? 'Traitement...' : 'Valider la commande' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const products = ref([]);
const orderQtys = ref({});
const loading = ref(false);
const isSubmitting = ref(false);

const emit = defineEmits(['submitted']);

const fetchProducts = async () => {
  loading.value = true;
  try {
    const companyId = localStorage.getItem('companyId'); 
    
    const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/products`, {
      params: { 
        company_id: companyId 
      },
      headers: { 
        Authorization: `Bearer ${localStorage.getItem('token')}` 
      }
    });
    
    products.value = res.data;
  } catch (err) {
    console.error("Erreur lors du chargement des produits:", err.response?.data || err.message);
  } finally {
    loading.value = false;
  }
};

const submitRestock = async () => {
  const items = Object.entries(orderQtys.value)
    .filter(([_, qty]) => qty > 0)
    .map(([product_id, quantity]) => ({ product_id, quantity }));

  if (items.length === 0) return alert("Veuillez sélectionner au moins un produit.");

  isSubmitting.value = true;
  try {
    const token = localStorage.getItem('token');
    await axios.post(`${import.meta.env.VITE_API_BASE_URL}/resellers/restock-request`, 
      { items },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    alert("Commande transmise à l'administration !");
    orderQtys.value = {}; 
    emit('submitted');
  } catch (err) { 
    console.error(err);
    alert("Échec de l'envoi de la commande."); 
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(fetchProducts);
</script>

<style scoped>
.restock-container { padding: 20px; background: #fff; border-radius: 8px; }
.header-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.stock-table { width: 100%; border-collapse: collapse; }
.stock-table th { text-align: left; padding: 12px; border-bottom: 2px solid #eee; }
.stock-table td { padding: 12px; border-bottom: 1px solid #eee; }
.prod-name { font-weight: bold; }
.prod-desc { color: #888; font-size: 0.8rem; }
.qty-input { width: 80px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
.btn-order { margin-top: 20px; padding: 12px 25px; background: #000; color: #fff; border: none; border-radius: 6px; cursor: pointer; width: 100%; font-weight: bold; }
.refresh-btn { background: #eee; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
.loader { text-align: center; padding: 20px; color: #666; }
</style>