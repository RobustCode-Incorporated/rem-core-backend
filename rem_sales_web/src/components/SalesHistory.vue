<template>
  <div class="history-module">
    <h2>🧾 Historique de mes Activités Commerciales</h2>
    
    <div v-if="loading" class="state-feedback">
      🔄 Chargement de votre historique...
    </div>

    <div v-else-if="salesHistory.length === 0" class="state-feedback">
      ⚠️ Aucune transaction (Vente ou Restock) enregistrée.
    </div>

    <!-- Tableau mis à jour -->
    <table v-else class="data-table" :class="{ 'no-print': isModalOpen }">
      <thead>
        <tr>
          <th>Numéro Facture</th>
          <th>Type</th>
          <th>Client / Fournisseur</th>
          <th>Date</th>
          <th>Montant</th>
          <th>Statut</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="doc in salesHistory" :key="doc.id">
          <td class="font-mono font-bold">{{ doc.number }}</td>
          <td>
            <span :class="['type-badge', doc.type?.toLowerCase()]">
              {{ doc.type === 'RESTOCK_REQUEST' ? '📦 RESTOCK' : '💼 VENTE' }}
            </span>
          </td>
          <!-- Résolution dynamique du bénéficiaire ou de la provenance -->
          <td class="font-bold">
            {{ doc.client_name || doc.reseller_name || (doc.type === 'RESTOCK_REQUEST' ? 'Dépôt Principal / Fournisseur' : 'Client de passage') }}
            <span v-if="doc.depot_name" class="depot-tag">({{ doc.depot_name }})</span>
          </td>
          <td>{{ formatDate(doc.created_at) }}</td>
          <td class="font-bold text-success">{{ Number(doc.total_amount).toLocaleString() }} $</td>
          <td>
            <span :class="['badge', doc.status.toLowerCase()]">
              {{ doc.status }}
            </span>
          </td>
          <td>
            <button @click="openInvoice(doc)" class="action-btn" title="Consulter le document">👁️ Voir</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- ─── MODAL APPAREIL DE FACTURATION ─── -->
    <div v-if="isModalOpen" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        
        <div class="modal-actions-bar no-print">
          <button @click="printInvoice" class="btn-action-print">🖨️ Imprimer / PDF</button>
          <a :href="whatsappLink" target="_blank" class="btn-action-whatsapp">💬 WhatsApp</a>
          <a :href="emailLink" class="btn-action-email">✉️ Email</a>
          
          <!-- 🛡️ CONDITION : Sécurité sur l'annulation (Interdit sur les RESTOCK_REQUEST) -->
          <button 
            v-if="selectedInvoice.type !== 'RESTOCK_REQUEST' && (selectedInvoice.status === 'PAID' || selectedInvoice.status === 'DRAFT')" 
            @click="handleCancelInvoice(selectedInvoice.id)" 
            class="btn-action-cancel-invoice"
          >
            ❌ Annuler la vente
          </button>

          <button @click="closeModal" class="btn-action-close">Fermer ✕</button>
        </div>

        <div class="invoice-paper">
          <div class="invoice-header">
            <div class="logo-container">
              <img :src="logoRobustCode" alt="Robust Code Inc. Logo" class="invoice-logo-img" />
              <p class="company-details">Solutions Technologiques Multi-tenant<br>Bruxelles, Belgique</p>
            </div>
            <div class="invoice-meta-block">
              <h2>{{ selectedInvoice.type === 'RESTOCK_REQUEST' ? 'BON DE COMMANDE / RESTOCK' : 'REÇU DE VENTE' }}</h2>
              <p><strong>N° :</strong> {{ selectedInvoice.number }}</p>
              <p><strong>Date :</strong> {{ formatDate(selectedInvoice.created_at) }}</p>
              <p><strong>Statut :</strong> <span :class="['invoice-status-inline', selectedInvoice.status.toLowerCase()]">{{ selectedInvoice.status }}</span></p>
            </div>
          </div>

          <hr class="invoice-separator" />

          <div class="invoice-bill-to">
            <h3>{{ selectedInvoice.type === 'RESTOCK_REQUEST' ? 'Provenance / Émetteur :' : 'Facturé à / Bénéficiaire :' }}</h3>
            <p class="client-name">
              {{ selectedInvoice.client_name || selectedInvoice.reseller_name || (selectedInvoice.type === 'RESTOCK_REQUEST' ? 'Dépôt Principal / Fournisseur' : 'Client de passage') }}
              <span v-if="selectedInvoice.depot_name" class="depot-tag-modal">({{ selectedInvoice.depot_name }})</span>
            </p>
            <p class="client-details">ID Document : {{ selectedInvoice.id }}</p>
          </div>

          <table class="invoice-items-table">
            <thead>
              <tr>
                <th>Description Produit</th>
                <th class="text-right">Quantité</th>
                <th class="text-right">Prix Unitaire</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in selectedInvoiceItems" :key="item.id">
                <td>{{ item.product_name || 'Article REM System' }}</td>
                <td class="text-right">{{ item.quantity }}</td>
                <td class="text-right">{{ Number(item.unit_price).toLocaleString() }} $</td>
                <td class="text-right font-bold">{{ Number(item.total_price).toLocaleString() }} $</td>
              </tr>
              <tr v-if="itemsLoading">
                <td colspan="4" class="text-center text-muted">🔄 Récupération de la structure des articles...</td>
              </tr>
              <tr v-else-if="selectedInvoiceItems.length === 0">
                <td colspan="4" class="text-center text-muted">⚠️ Aucun article répertorié.</td>
              </tr>
            </tbody>
          </table>

          <div class="invoice-total-block">
            <div class="total-row grand-total">
              <span>Montant Net Global (USD) :</span>
              <span>{{ Number(selectedInvoice.total_amount).toLocaleString() }} $</span>
            </div>
          </div>

          <div class="invoice-footer">
            <p>Merci pour votre confiance !</p>
            <p class="footer-legal">Robust Code Inc. — Document généré via REM Engine</p>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { useSalesStore } from '../stores/sales';
import logoRobustCode from '../assets/RobustCodelogowhite.png';

const salesStore = useSalesStore();

const salesHistory = ref([]);
const loading = ref(false);
const itemsLoading = ref(false);

const isModalOpen = ref(false);
const selectedInvoice = ref(null);
const selectedInvoiceItems = ref([]);

// Suppression de ?type=SALE pour remonter à la fois les ventes et les restocks liés au revendeur
const fetchSales = async () => {
  loading.value = true;
  try {
    const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/sales/documents`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    salesHistory.value = res.data.data || res.data;
  } catch (err) {
    console.error("❌ Erreur de chargement des flux :", err);
  } finally {
    loading.value = false;
  }
};

const fetchInvoiceItems = async (documentId) => {
  itemsLoading.value = true;
  try {
    const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/sales/documents/${documentId}/items`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    selectedInvoiceItems.value = res.data.data || res.data;
  } catch (err) {
    console.error("❌ Erreur de mapping lignes articles :", err);
    selectedInvoiceItems.value = [];
  } finally {
    itemsLoading.value = false;
  }
};

const openInvoice = async (sale) => {
  selectedInvoice.value = sale;
  isModalOpen.value = true;
  selectedInvoiceItems.value = [];
  await fetchInvoiceItems(sale.id);
};

const closeModal = () => {
  isModalOpen.value = false;
  selectedInvoice.value = null;
  selectedInvoiceItems.value = [];
};

const handleCancelInvoice = async (id) => {
  if (confirm("⚠️ Attention : Êtes-vous sûr de vouloir détruire cette vente ? Vos stocks seront recrédités.")) {
    try {
      await salesStore.cancelInvoice(id);
      selectedInvoice.value.status = 'CANCELLED';
      await fetchSales();
      alert("Vente annulée avec succès.");
    } catch (error) {
      alert("L'opération d'annulation a échoué.");
    }
  }
};

const printInvoice = () => {
  window.print();
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const whatsappLink = computed(() => {
  if (!selectedInvoice.value) return '#';
  const label = selectedInvoice.value.type === 'RESTOCK_REQUEST' ? 'Bon de Commande' : 'Reçu de vente';
  const text = encodeURIComponent(
    `Bonjour, voici le document (${label}) N° ${selectedInvoice.value.number} d'un montant global de ${Number(selectedInvoice.value.total_amount).toLocaleString()} $.`
  );
  return `https://api.whatsapp.com/send?text=${text}`;
});

const emailLink = computed(() => {
  if (!selectedInvoice.value) return '#';
  const label = selectedInvoice.value.type === 'RESTOCK_REQUEST' ? 'Restock / Approvisionnement' : 'Reçu de Vente';
  const subject = encodeURIComponent(`Document Commercial Robust Code - ${selectedInvoice.value.number}`);
  const body = encodeURIComponent(
    `Bonjour,\n\nType de flux : ${label}\nRéférence : ${selectedInvoice.value.number}\nMontant : ${Number(selectedInvoice.value.total_amount).toLocaleString()} $\nStatut actuel : ${selectedInvoice.value.status}\n\nCordialement.`
  );
  return `mailto:?subject=${subject}&body=${body}`;
});

onMounted(fetchSales);
</script>

<style scoped>
.history-module { background: #fff; padding: 24px; border-radius: 8px; border: 1px solid #e2e8f0; }
.state-feedback { text-align: center; padding: 30px; color: #64748b; font-style: italic; }

.data-table { width: 100%; border-collapse: collapse; background: #fff; margin-top: 20px; font-size: 0.9rem; }
.data-table th { background: #f8fafc; color: #475569; font-weight: 600; padding: 15px; border-bottom: 2px solid #e2e8f0; text-align: left; }
.data-table td { padding: 15px; border-bottom: 1px solid #eee; }

.font-mono { font-family: monospace; }
.font-bold { font-weight: bold; }
.text-success { color: #10b981; }
.text-right { text-align: right; }
.text-center { text-align: center; }
.text-muted { color: #64748b; font-style: italic; }
.depot-tag { font-weight: normal; font-size: 0.8rem; color: #64748b; font-style: italic; margin-left: 4px; }
.depot-tag-modal { font-weight: normal; font-size: 0.9rem; color: #64748b; font-style: italic; margin-left: 6px; }

/* Styles CSS pour les Badges de flux */
.type-badge { padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; background: #e2e8f0; color: #334155; }
.type-badge.restock_request { background: #dbeafe; color: #1e40af; }

.badge { padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; }
.badge.paid { background: #d1fae5; color: #065f46; }
.badge.draft { background: #fef3c7; color: #92400e; }
.badge.cancelled { background: #fee2e2; color: #991b1b; }

.invoice-status-inline { font-weight: bold; text-transform: uppercase; }
.invoice-status-inline.paid { color: #10b981; }
.invoice-status-inline.draft { color: #f59e0b; }
.invoice-status-inline.cancelled { color: #ef4444; }

.action-btn { background: #0f172a; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 0.85rem; }
.action-btn:hover { background: #334155; }

/* Modals styles architectural */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 9999; }
.modal-content { background: #f8fafc; width: 90%; max-width: 800px; max-height: 90vh; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); display: flex; flex-direction: column; overflow: hidden; }
.modal-actions-bar { background: #1e293b; padding: 12px 24px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.modal-actions-bar button, .modal-actions-bar a { padding: 8px 16px; border-radius: 6px; font-size: 0.85rem; font-weight: 600; text-decoration: none; cursor: pointer; border: none; transition: background 0.2s ease; }

.btn-action-print { background: #3b82f6; color: white; }
.btn-action-print:hover { background: #2563eb; }
.btn-action-whatsapp { background: #22c55e; color: white; }
.btn-action-whatsapp:hover { background: #16a34a; }
.btn-action-email { background: #64748b; color: white; }
.btn-action-email:hover { background: #475569; }
.btn-action-cancel-invoice { background: #ef4444; color: white; }
.btn-action-cancel-invoice:hover { background: #dc2626; }
.btn-action-close { background: #475569; color: white; margin-left: auto; }

.invoice-paper { background: #ffffff; padding: 40px; overflow-y: auto; flex: 1; color: #1e293b; font-family: system-ui, sans-serif; }
.invoice-header { display: flex; justify-content: space-between; align-items: flex-start; }
.logo-container { display: flex; flex-direction: column; gap: 8px; }
.invoice-logo-img { max-width: 150px; height: auto; object-fit: contain; filter: brightness(0) contrast(100%); }
.company-details { font-size: 0.8rem; color: #64748b; line-height: 1.4; margin: 0; }
.invoice-meta-block { text-align: right; }
.invoice-meta-block h2 { font-size: 1.4rem; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; }
.invoice-meta-block p { margin: 4px 0; font-size: 0.85rem; color: #475569; }
.invoice-separator { border: 0; border-top: 2px solid #f1f5f9; margin: 24px 0; }
.invoice-bill-to h3 { font-size: 0.8rem; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
.client-name { font-size: 1rem; font-weight: 700; margin: 0 0 4px 0; color: #0f172a; }
.client-details { font-size: 0.8rem; color: #64748b; margin: 0; }

.invoice-items-table { width: 100%; border-collapse: collapse; margin-top: 24px; }
.invoice-items-table th { background: #f8fafc; padding: 10px; font-size: 0.75rem; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #cbd5e1; }
.invoice-items-table td { padding: 12px 10px; font-size: 0.9rem; border-bottom: 1px solid #f1f5f9; }

.invoice-total-block { width: 50%; margin-left: auto; margin-top: 24px; }
.total-row { display: flex; justify-content: space-between; font-size: 0.9rem; }
.grand-total { font-size: 1.1rem; font-weight: 800; color: #0f172a; border-top: 2px solid #0f172a; padding-top: 8px; }
.invoice-footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 0.85rem; }

@media print {
  .no-print, .no-print * { display: none !important; }
  .modal-overlay { position: absolute !important; background: none !important; padding: 0 !important; }
  .modal-content { box-shadow: none !important; width: 100% !important; max-width: 100% !important; }
  .invoice-paper { padding: 0 !important; width: 100% !important; }
}
</style>