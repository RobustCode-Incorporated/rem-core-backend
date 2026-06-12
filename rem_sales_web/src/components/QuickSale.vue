<template>
  <div class="caisse-container">
    <div class="left-panel">
      <div class="panel-section">
        <h3>👤 Informations Client (Détail)</h3>
        <div class="client-form">
          <div class="form-group">
            <label>Nom complet *</label>
            <input v-model="clientForm.name" type="text" placeholder="Ex: Jean Dupont" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Téléphone</label>
              <input v-model="clientForm.phone" type="text" placeholder="+32..." />
            </div>
            <div class="form-group">
              <label>Email</label>
              <input v-model="clientForm.email" type="email" placeholder="client@gmail.com" />
            </div>
          </div>
          <div class="form-group">
            <label>Adresse de livraison / résidence</label>
            <textarea v-model="clientForm.address" placeholder="Rue de la Loi, Bruxelles..."></textarea>
          </div>
        </div>
      </div>

      <div class="panel-section current-stock-section">
        <h3>📦 Articles disponibles dans votre dépôt</h3>
        <div v-if="loadingStock" class="mini-loader">Chargement de votre inventaire...</div>
        
        <div v-else class="products-selection-grid">
          <div 
            v-for="item in resellerStock" 
            :key="item.id" 
            class="product-selection-card"
            :class="{ 'out-of-stock': item.quantity <= 0 }"
            @click="addItemToCart(item)"
          >
            <div class="p-info">
              <span class="p-name">{{ item.products?.name || item.product_name }}</span>
              <span class="p-qty">Dispo: <strong>{{ item.quantity }}</strong> unités</span>
            </div>
            <button class="add-btn" :disabled="item.quantity <= 0">＋</button>
          </div>
        </div>
      </div>
    </div>

    <div class="right-panel">
      <div class="checkout-card">
        <h3>🛒 Panier de Vente Directe</h3>
        
        <div v-if="cart.length === 0" class="empty-cart">
          <p>Le panier est vide. Cliquez sur un article à gauche pour l'ajouter.</p>
        </div>

        <div v-else class="cart-items-list">
          <div v-for="(cartItem, index) in cart" :key="cartItem.product_id" class="cart-item">
            <div class="item-meta">
              <h4>{{ cartItem.name }}</h4>
              <p>Stock max : {{ cartItem.maxAvailable }}</p>
            </div>
            <div class="item-actions">
              <input 
                type="number" 
                v-model.number="cartItem.selectedQty" 
                min="1" 
                :max="cartItem.maxAvailable"
                @change="validateCartQty(index)"
              />
              <button @click="removeSrcItem(index)" class="delete-btn">🗑️</button>
            </div>
          </div>
        </div>

        <div class="price-summary">
          <div class="summary-row">
            <span>Total Articles :</span>
            <strong>{{ totalArticlesCount }}</strong>
          </div>
        </div>

        <button 
          @click="processCheckout" 
          class="checkout-submit-btn" 
          :disabled="cart.length === 0 || !clientForm.name || isSubmitting"
        >
          {{ isSubmitting ? 'Validation de la vente...' : 'Valider et Encaisser la Vente' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';

const resellerStock = ref([]);
const loadingStock = ref(true);
const isSubmitting = ref(false);
const cart = ref([]);

const clientForm = ref({
  name: '',
  phone: '',
  email: '',
  address: ''
});

const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

const fetchResellerInventory = async () => {
  loadingStock.value = true;
  try {
    const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/resellers/me/stock`, { headers });
    resellerStock.value = res.data || [];
  } catch (err) {
    console.error("Erreur chargement stock caisse:", err);
  } finally {
    loadingStock.value = false;
  }
};

const addItemToCart = (stockItem) => {
  if (stockItem.quantity <= 0) return;

  const existingIndex = cart.value.findIndex(c => c.product_id === stockItem.product_id);
  if (existingIndex > -1) {
    if (cart.value[existingIndex].selectedQty < stockItem.quantity) {
      cart.value[existingIndex].selectedQty++;
    }
  } else {
    cart.value.push({
      product_id: stockItem.product_id,
      name: stockItem.products?.name || stockItem.product_name,
      selectedQty: 1,
      maxAvailable: stockItem.quantity
    });
  }
};

const validateCartQty = (index) => {
  const item = cart.value[index];
  if (item.selectedQty > item.maxAvailable) {
    item.selectedQty = item.maxAvailable;
    alert(`Quantité limitée au stock disponible (${item.maxAvailable} unités).`);
  }
  if (item.selectedQty < 1 || !item.selectedQty) item.selectedQty = 1;
};

const removeSrcItem = (index) => {
  cart.value.splice(index, 1);
};

const totalArticlesCount = computed(() => {
  return cart.value.reduce((acc, item) => acc + item.selectedQty, 0);
});

const processCheckout = async () => {
  if (!clientForm.value.name) return;
  isSubmitting.value = true;

  try {
    const payload = {
      client: {
        ...clientForm.value,
        company_id: localStorage.getItem('companyId')
      },
      items: cart.value.map(item => ({
        product_id: item.product_id,
        quantity: item.selectedQty
      }))
    };

    await axios.post(`${import.meta.env.VITE_API_BASE_URL}/sales/retail-checkout`, payload, { headers });
    
    alert("Vente enregistrée avec succès, les stocks du dépôt ont été déduits !");
    
    // Reset Form & Cart
    cart.value = [];
    clientForm.value = { name: '', phone: '', email: '', address: '' };
    
    // Refresh local stock updated values from DB
    await fetchResellerInventory();
  } catch (err) {
    alert("Erreur lors de la validation : " + (err.response?.data?.message || err.message));
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(() => {
  fetchResellerInventory();
});
</script>

<style scoped>
.caisse-container { display: grid; grid-template-columns: 1fr 400px; gap: 30px; max-width: 1200px; margin: 0 auto; padding: 20px 0; }
.panel-section { background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 25px; margin-bottom: 25px; }
.panel-section h3 { margin: 0 0 20px 0; font-size: 1.1rem; color: #111; border-bottom: 1px solid #f5f5f5; padding-bottom: 10px; }

.client-form { display: flex; flex-direction: column; gap: 15px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
.form-group { display: flex; flex-direction: column; gap: 5px; }
.form-group label { font-size: 0.8rem; color: #666; font-weight: 600; text-transform: uppercase; }
.form-group input, .form-group textarea { padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.95rem; }
.form-group textarea { height: 60px; resize: none; }

.products-selection-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 15px; }
.product-selection-card { background: #fafafa; border: 1px solid #eee; padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s; }
.product-selection-card:hover { border-color: #111; background: #fff; }
.out-of-stock { opacity: 0.5; cursor: not-allowed; background: #f5f5f5; }
.p-info { display: flex; flex-direction: column; gap: 4px; }
.p-name { font-weight: bold; color: #111; font-size: 0.95rem; }
.p-qty { font-size: 0.8rem; color: #666; }
.add-btn { background: #111; color: #fff; border: none; width: 30px; height: 30px; border-radius: 6px; font-weight: bold; cursor: pointer; }

/* Panier */
.checkout-card { background: #111; color: #fff; border-radius: 12px; padding: 25px; position: sticky; top: 20px; }
.checkout-card h3 { margin: 0 0 20px 0; font-size: 1.1rem; color: #fff; border-bottom: 1px solid #222; padding-bottom: 10px; }
.empty-cart { text-align: center; color: #666; font-size: 0.9rem; padding: 40px 0; }
.cart-items-list { max-height: 300px; overflow-y: auto; margin-bottom: 20px; display: flex; flex-direction: column; gap: 12px; }
.cart-item { background: #1c1c1c; padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
.item-meta h4 { margin: 0 0 4px 0; font-size: 0.9rem; color: #fff; }
.item-meta p { margin: 0; font-size: 0.75rem; color: #888; }
.item-actions { display: flex; align-items: center; gap: 10px; }
.item-actions input { width: 60px; padding: 6px; background: #222; border: 1px solid #333; color: #fff; border-radius: 4px; text-align: center; }
.delete-btn { background: none; border: none; cursor: pointer; font-size: 1.1rem; }

.price-summary { border-top: 1px solid #222; padding-top: 15px; margin-bottom: 20px; }
.summary-row { display: flex; justify-content: space-between; font-size: 0.95rem; }
.checkout-submit-btn { w: 100%; width: 100%; padding: 15px; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 1rem; cursor: pointer; transition: background 0.2s; }
.checkout-submit-btn:disabled { background: #333; color: #666; cursor: not-allowed; }
</style>