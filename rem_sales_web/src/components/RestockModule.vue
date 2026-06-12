<template>
  <div class="restock-module">
    <div class="header">
      <h2>📦 Mon Inventaire & Commandes</h2>
      <button @click="showOrderForm = !showOrderForm" class="btn-primary">
        {{ showOrderForm ? 'Fermer le catalogue' : '+ Commander au dépôt' }}
      </button>
    </div>

    <CreateRestockForm v-if="showOrderForm" @submitted="onOrderSubmitted" />

    <div v-else>
      <h3>Mes demandes de réapprovisionnement</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>Numéro</th>
            <th>Date</th>
            <th>Statut</th>
            <th>Montant Total</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="doc in restockHistory" :key="doc.id">
            <td>{{ doc.number }}</td>
            <td>{{ new Date(doc.created_at).toLocaleDateString() }}</td>
            <td>
              <span :class="['badge', doc.status.toLowerCase()]">{{ doc.status }}</span>
            </td>
            <td>{{ doc.total_amount }} $</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import CreateRestockForm from './CreateRestockForm.vue'; // Assure-toi d'avoir ce fichier dans le même dossier

const showOrderForm = ref(false);
const restockHistory = ref([]);

const fetchRestockHistory = async () => {
  try {
    const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/sales/documents?type=RESTOCK_REQUEST`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    restockHistory.value = res.data.data;
  } catch (err) {
    console.error("Erreur chargement historique restock", err);
  }
};

const onOrderSubmitted = () => {
  showOrderForm.value = false;
  fetchRestockHistory();
};

onMounted(fetchRestockHistory);
</script>

<style scoped>
.header { display: flex; justify-content: space-between; margin-bottom: 20px; }
.btn-primary { background: #000; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; }
.data-table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; }
.data-table th, .data-table td { padding: 15px; text-align: left; border-bottom: 1px solid #eee; }
.badge { padding: 5px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: bold; }
.badge.paid { background: #d1fae5; color: #065f46; }
.badge.draft { background: #fef3c7; color: #92400e; }
</style>