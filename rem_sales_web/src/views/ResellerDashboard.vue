<template>
  <div class="dashboard-container">
    <header class="top-navbar">
      <div class="brand-zone">
        <img src="../assets/RobustCodelogowhite.png" alt="Logo REM" class="logo-top" />
        <h1 class="brand-title">ROBUST ENTERPRISE MANAGEMENT</h1>
      </div>

      <div class="nav-right">
        <nav class="nav-menu">
          <button v-for="tab in tabs" :key="tab.id" 
                  :class="['nav-item', { active: currentTab === tab.id }]"
                  @click="currentTab = tab.id">
            {{ tab.icon }} {{ tab.label }}
          </button>
        </nav>
        <button @click="logout" class="logout-btn">Déconnexion</button>
      </div>
    </header>

    <main class="content-area">
      <section class="content-body">
        <component :is="activeComponent" />
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';

// Imports composants
import DashboardStats from '../components/DashboardStats.vue';
import QuickSale from '../components/QuickSale.vue';
import RestockModule from '../components/RestockModule.vue';
import SalesHistory from '../components/SalesHistory.vue';
import GeolocationModule from '../components/GeolocationModule.vue';

const router = useRouter();
const currentTab = ref('dashboard');

const tabs = [
  { id: 'dashboard', label: 'Vue d\'ensemble', icon: '📊' },
  { id: 'pos', label: 'Caisse', icon: '🛒' },
  { id: 'restock', label: 'Stock & Commande', icon: '📦' },
  { id: 'history', label: 'Historique', icon: '🧾' },
  { id: 'geo', label: 'Position', icon: '📍' }
];

const activeComponent = computed(() => {
  const map = {
    dashboard: DashboardStats,
    pos: QuickSale,
    restock: RestockModule,
    history: SalesHistory,
    geo: GeolocationModule
  };
  return map[currentTab.value];
});

const logout = () => {
  localStorage.clear();
  router.push('/login');
};
</script>

<style scoped>
.dashboard-container { 
  display: flex; 
  flex-direction: column; 
  height: 100vh; 
  background: #FFFAFA; 
  font-family: 'ABeeZee', sans-serif; 
}

.top-navbar {
  background: #000;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 40px;
}

.brand-zone { 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
}

.logo-top { width: 120px; height: auto; margin-bottom: 2px; }

.brand-title { 
  color: #FFFAFA; 
  font-size: 0.60rem; 
  letter-spacing: 1.5px; 
  font-weight: 400; 
  text-transform: uppercase;
  margin: 0;
}

.nav-right { display: flex; align-items: center; gap: 30px; }
.nav-menu { display: flex; gap: 20px; }

.nav-item {
  background: transparent;
  color: #A0A0A0;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
  transition: 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}
.nav-item:hover, .nav-item.active { color: #fff; }

.logout-btn { 
  background: transparent; 
  color: #fff; 
  border: 1px solid #333; 
  padding: 6px 14px; 
  border-radius: 20px; 
  font-size: 0.75rem;
  cursor: pointer; 
  transition: 0.3s;
}
.logout-btn:hover { background: #fff; color: #000; }

.content-area { flex: 1; padding: 40px; overflow-y: auto; }
</style>