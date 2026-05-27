<template>
  <div class="resellers-page">
    <div class="page-header">
      <h1>Gestion des Revendeurs</h1>
      <button @click="showForm = !showForm" class="btn-toggle">
        {{ showForm ? 'Fermer' : '+ Ajouter un revendeur' }}
      </button>
    </div>

    <div v-if="showForm" class="form-section">
      <ResellerForm @created="fetchResellers" />
    </div>

    <div class="table-container">
      <h3>Liste des partenaires</h3>
      <table class="reseller-table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Email</th>
            <th>Dépôt</th>
            <th>Téléphone</th>
            <th>Position</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="reseller in resellers" :key="reseller.id">
            <td>{{ reseller.name }}</td>
            <td>{{ reseller.email }}</td>
            <td>{{ reseller.deposit_name }}</td>
            <td>{{ reseller.phone }}</td>
            <td>
              <span v-if="reseller.latitude" class="badge-ok">Localisé</span>
              <span v-else class="badge-wait">En attente</span>
            </td>
          </tr>
          <tr v-if="resellers.length === 0">
            <td colspan="5" class="empty-msg">Aucun revendeur enregistré.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import ResellerForm from './ResellerForm.vue'

const showForm = ref(false)
const resellers = ref([])

const fetchResellers = async () => {
  const companyId = localStorage.getItem('companyId')
  try {
    const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/resellers`, {
      params: { company_id: companyId }
    })
    resellers.value = res.data
  } catch (err) {
    console.error('Erreur chargement revendeurs:', err)
  }
}

onMounted(fetchResellers)
</script>

<style scoped>
.resellers-page { padding: 20px; font-family: 'ABeeZee', sans-serif; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
.btn-toggle { background: #000; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; }

.form-section { margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
.table-container { background: white; padding: 20px; border-radius: 8px; border: 1px solid #eee; }
.reseller-table { width: 100%; border-collapse: collapse; }
.reseller-table th, .reseller-table td { padding: 15px; border-bottom: 1px solid #eee; text-align: left; }

.badge-ok { background: #e8f5e9; color: #2e7d32; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; }
.badge-wait { background: #fff3e0; color: #ef6c00; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; }
.empty-msg { text-align: center; color: #999; padding: 20px; }
</style>