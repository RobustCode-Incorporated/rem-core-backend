<template>
  <div class="form-container">
    <div class="form-header">
      <h2>Ajouter un nouveau revendeur</h2>
    </div>

    <form @submit.prevent="submitReseller" class="reseller-form">
      <div class="form-row">
        <div class="form-group">
          <label>Nom du Revendeur</label>
          <input v-model="form.name" type="text" placeholder="Ex: Jean Dupont" required />
        </div>
        <div class="form-group">
          <label>Email (Connexion)</label>
          <input v-model="form.email" type="email" placeholder="revendeur@email.com" required />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Téléphone</label>
          <input v-model="form.phone" type="tel" placeholder="+243 XXX XXX XXX" required />
        </div>
        <div class="form-group">
          <label>Nom du Dépôt</label>
          <input v-model="form.deposit_name" type="text" placeholder="Ex: Dépôt Centre-Ville" required />
        </div>
      </div>

      <div class="form-group">
        <label>Mot de passe temporaire</label>
        <input v-model="form.password" type="password" placeholder="********" required />
      </div>

      <button type="submit" class="btn-submit" :disabled="loading">
        {{ loading ? 'Enregistrement...' : 'Créer le compte revendeur' }}
      </button>
    </form>

    <hr class="divider" />

    <div class="list-section">
      <h3>Liste des revendeurs</h3>
      <table class="reseller-table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Email</th>
            <th>Dépôt</th>
            <th>Téléphone</th>
            <th>Statut GPS</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="reseller in resellers" :key="reseller.id">
            <td>{{ reseller.name }}</td>
            <td>{{ reseller.email }}</td>
            <td>{{ reseller.deposit_name }}</td>
            <td>{{ reseller.phone }}</td>
            <td>
              <span :class="['badge', reseller.latitude ? 'ok' : 'wait']">
                {{ reseller.latitude ? 'Localisé' : 'En attente' }}
              </span>
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

const loading = ref(false)
const resellers = ref([])
const form = ref({ name: '', email: '', password: '', phone: '', deposit_name: '' })

const fetchResellers = async () => {
  try {
    const companyId = localStorage.getItem('companyId')
    const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/resellers`, {
      params: { company_id: companyId }
    })
    resellers.value = res.data
  } catch (err) { console.error(err) }
}

const submitReseller = async () => {
  loading.value = true
  try {
    const companyId = localStorage.getItem('companyId')
    await axios.post(`${import.meta.env.VITE_API_BASE_URL}/resellers`, {
      ...form.value,
      company_id: companyId
    })
    alert('Revendeur créé avec succès !')
    form.value = { name: '', email: '', password: '', phone: '', deposit_name: '' }
    await fetchResellers() // Rafraîchir la liste
  } catch (error) {
    alert('Erreur lors de la création.')
  } finally {
    loading.value = false
  }
}

onMounted(fetchResellers)
</script>

<style scoped>
.form-container { background: white; padding: 40px; border-radius: 8px; max-width: 700px; margin: 0 auto; font-family: 'ABeeZee', sans-serif; }
.form-header { margin-bottom: 30px; }
.reseller-form { 
  display: flex; 
  flex-direction: column; 
  gap: 25px; 
  margin-bottom: 40px; 
}
.reseller-form { display: flex; flex-direction: column; gap: 20px; margin-bottom: 40px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.form-group { display: flex; flex-direction: column; gap: 8px; }
input { padding: 14px; border: 1px solid #ddd; border-radius: 6px; }
.btn-submit { background: #000; color: #fff; border: none; padding: 15px; border-radius: 6px; cursor: pointer; }
.divider { border: 0; border-top: 1px solid #eee; margin: 30px 0; }
.reseller-table { width: 100%; border-collapse: collapse; }
.reseller-table th, .reseller-table td { padding: 12px; border-bottom: 1px solid #eee; text-align: left; font-size: 0.9rem; }
.badge { padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
.badge.ok { background: #e8f5e9; color: #2e7d32; }
.badge.wait { background: #fff3e0; color: #ef6c00; }
.empty-msg { text-align: center; color: #999; padding: 20px; }
</style>