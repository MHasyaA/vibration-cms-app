<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import MetricCard from './components/MetricCard.vue';
import ScadaMotorSvg from './components/ScadaMotorSvg.vue';
import TrendLineChart from './components/TrendLineChart.vue';
import DeviceModal from './components/DeviceModal.vue';
import ModbusConfigModal from './components/ModbusConfigModal.vue';
import ModbusRegisterModal from './components/ModbusRegisterModal.vue';
import darkLogo from './assets/dark_logo.png';
import lightLogo from './assets/light_logo.png';
import { 
  DUMMY_DEVICES, 
  generateDummyTelemetries, 
  DUMMY_ALARMS_ACTIVE, 
  DUMMY_ALARMS_HISTORY, 
  DUMMY_ANALYTICS_SUMMARY, 
  generateDummyTrend,
  DUMMY_MODBUS_CONNECTIONS
} from './utils/dummyData';

// --- State Router ---
const activePage = ref<'login' | 'overview' | 'detail' | 'alarms' | 'devices' | 'modbus-config'>('login');
const theme = ref<'dark' | 'light'>('dark');
const isDummyMode = ref(false);

// --- Auth State ---
const username = ref(localStorage.getItem('scada_username') || '');
const password = ref(localStorage.getItem('scada_password') || '');
const userRole = ref(localStorage.getItem('scada_role') || '');
const isLoggedIn = ref(!!localStorage.getItem('scada_logged_in'));
const loginError = ref<string | null>(null);
const loginLoading = ref(false);

// --- SCADA Telemetry & Config State ---
const devicesList = ref<any[]>([]);
const realtimeData = ref<any[]>([]);
const activeAlarms = ref<any[]>([]);
const alarmHistory = ref<any[]>([]);
const selectedDeviceId = ref<number | null>(null);
const historicalLogs = ref<any[]>([]);

// Analytics Summary Data
const totalDevicesCount = ref(0);
const activeAlarmsCount = ref(0);
const deviceStatsList = ref<any[]>([]);

// Trend Filter State
const trendStart = ref<string | undefined>(undefined);
const trendEnd = ref<string | undefined>(undefined);

// --- Modals State ---
const showDeviceModal = ref(false);
const selectedDeviceForEdit = ref<any | null>(null);

// --- Modbus Config State ---
const modbusConnections = ref<any[]>([]);
const showModbusModal = ref(false);
const selectedConnectionForEdit = ref<any | null>(null);
const showRegisterModal = ref(false);
const selectedDeviceForRegister = ref<any | null>(null);
const modbusTestResult = ref<Record<number, { loading: boolean; message: string; ok: boolean }>>({});

// --- Polling Interval ---
let pollInterval: any = null;

// --- Helper: Basic Auth Headers ---
function getHeaders() {
  const token = btoa(`${username.value}:${password.value}`);
  return {
    'Authorization': `Basic ${token}`,
    'Content-Type': 'application/json'
  };
}

// --- Watchers ---
watch(theme, (newTheme) => {
  if (newTheme === 'light') {
    document.documentElement.classList.add('light-theme');
  } else {
    document.documentElement.classList.remove('light-theme');
  }
}, { immediate: true });

watch(isDummyMode, async () => {
  await loadAllData();
});

// --- Functions: Auth ---
async function handleLogin() {
  if (!username.value || !password.value) {
    loginError.value = 'Silakan isi username dan password';
    return;
  }
  
  loginLoading.value = true;
  loginError.value = null;
  
  try {
    // Attempt authentication by fetching devices list (requires auth)
    const token = btoa(`${username.value}:${password.value}`);
    const res = await fetch('/api/devices', {
      headers: { 'Authorization': `Basic ${token}` }
    });
    
    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Kredensial salah. Gunakan admin/adminpassword atau user/userpassword');
      }
      throw new Error(`Koneksi Backend Gagal (${res.status})`);
    }
    
    const result = await res.json();
    if (result.success) {
      // Determine role from credentials (simple client-side heuristic for simulation, backed by real RBAC at backend)
      const role = username.value === 'admin' ? 'admin' : 'user';
      
      localStorage.setItem('scada_username', username.value);
      localStorage.setItem('scada_password', password.value);
      localStorage.setItem('scada_role', role);
      localStorage.setItem('scada_logged_in', 'true');
      
      userRole.value = role;
      isLoggedIn.value = true;
      loginError.value = null;
      activePage.value = 'overview';
      
      // Load initial application data
      await loadAllData();
      startPolling();
    } else {
      throw new Error(result.message || 'Gagal login.');
    }
  } catch (err: any) {
    loginError.value = err.message || 'Terjadi kesalahan sistem.';
  } finally {
    loginLoading.value = false;
  }
}

function handleLogout() {
  localStorage.clear();
  username.value = '';
  password.value = '';
  userRole.value = '';
  isLoggedIn.value = false;
  activePage.value = 'login';
  stopPolling();
}

// --- Functions: API Integrations ---
async function loadAllData() {
  if (!isLoggedIn.value) return;
  
  try {
    await Promise.all([
      fetchDevices(),
      fetchRealtimeTelemetries(),
      fetchAlarms(),
      fetchAnalyticsSummary(),
      fetchModbusConnections()
    ]);
    
    // Set first device as default selected in detail view if none selected
    if (selectedDeviceId.value === null && devicesList.value.length > 0) {
      selectedDeviceId.value = devicesList.value[0].id;
      await fetchHistoricalTrend(selectedDeviceId.value!);
    }
  } catch (err) {
    console.error('Failed to load application data:', err);
  }
}

async function fetchDevices() {
  if (isDummyMode.value) {
    devicesList.value = DUMMY_DEVICES;
    return;
  }
  const res = await fetch('/api/devices', { headers: getHeaders() });
  if (res.status === 401) handleLogout();
  const result = await res.json();
  if (result.success) {
    devicesList.value = result.data;
  }
}

async function fetchRealtimeTelemetries() {
  if (isDummyMode.value) {
    realtimeData.value = generateDummyTelemetries();
    return;
  }
  const res = await fetch('/api/data/realtime', { headers: getHeaders() });
  const result = await res.json();
  if (result.success) {
    realtimeData.value = result.data;
  }
}

async function fetchAlarms() {
  if (isDummyMode.value) {
    activeAlarms.value = DUMMY_ALARMS_ACTIVE;
    alarmHistory.value = DUMMY_ALARMS_HISTORY;
    return;
  }
  const [activeRes, historyRes] = await Promise.all([
    fetch('/api/alarms?status=active', { headers: getHeaders() }),
    fetch('/api/alarms?status=acknowledged', { headers: getHeaders() })
  ]);
  
  const activeResult = await activeRes.json();
  const historyResult = await historyRes.json();
  
  if (activeResult.success) activeAlarms.value = activeResult.data;
  if (historyResult.success) alarmHistory.value = historyResult.data;
}

async function fetchAnalyticsSummary() {
  if (isDummyMode.value) {
    totalDevicesCount.value = DUMMY_ANALYTICS_SUMMARY.totalDevices;
    activeAlarmsCount.value = DUMMY_ANALYTICS_SUMMARY.totalActiveAlarms;
    deviceStatsList.value = DUMMY_ANALYTICS_SUMMARY.deviceStats;
    return;
  }
  const res = await fetch('/api/analytics/summary', { headers: getHeaders() });
  const result = await res.json();
  if (result.success) {
    totalDevicesCount.value = result.data.totalDevices;
    activeAlarmsCount.value = result.data.totalActiveAlarms;
    deviceStatsList.value = result.data.deviceStats;
  }
}

async function fetchHistoricalTrend(deviceId: number) {
  if (isDummyMode.value) {
    historicalLogs.value = generateDummyTrend(deviceId, trendStart.value, trendEnd.value);
    return;
  }
  
  let url = `/api/data/trend?deviceId=${deviceId}`;
  if (trendStart.value) url += `&start=${trendStart.value}`;
  if (trendEnd.value) url += `&end=${trendEnd.value}`;
  
  const res = await fetch(url, { headers: getHeaders() });
  const result = await res.json();
  if (result.success) {
    historicalLogs.value = result.data;
  }
}

function handleRangeChange(payload: { start?: string; end?: string }) {
  trendStart.value = payload.start;
  trendEnd.value = payload.end;
  if (selectedDeviceId.value !== null) {
    fetchHistoricalTrend(selectedDeviceId.value);
  }
}

// --- Alarm Actions ---
async function acknowledgeAlarm(alarmId: number) {
  // Dummy mode: handle locally without API
  if (isDummyMode.value) {
    const alarm = activeAlarms.value.find((a: any) => a.id === alarmId);
    if (alarm) {
      activeAlarms.value = activeAlarms.value.filter((a: any) => a.id !== alarmId);
      alarmHistory.value = [{ ...alarm, status: 'acknowledged' }, ...alarmHistory.value];
      activeAlarmsCount.value = activeAlarms.value.length;
    }
    return;
  }
  try {
    const res = await fetch(`/api/alarms/${alarmId}/acknowledge`, {
      method: 'PUT',
      headers: getHeaders()
    });
    const result = await res.json();
    if (result.success) {
      await loadAllData();
      if (selectedDeviceId.value !== null) {
        await fetchHistoricalTrend(selectedDeviceId.value);
      }
    }
  } catch (err) {
    console.error('Failed to acknowledge alarm:', err);
  }
}

// --- CRUD Device Actions ---
async function handleSaveDevice(payload: any) {
  // Dummy mode: simulate CRUD in local state
  if (isDummyMode.value) {
    if (selectedDeviceForEdit.value) {
      // UPDATE
      const idx = devicesList.value.findIndex((d: any) => d.id === selectedDeviceForEdit.value.id);
      if (idx !== -1) devicesList.value[idx] = { ...devicesList.value[idx], ...payload };
    } else {
      // CREATE
      const newId = Math.max(...devicesList.value.map((d: any) => d.id)) + 1;
      devicesList.value = [...devicesList.value, { id: newId, slaveId: newId + 100, ...payload }];
    }
    showDeviceModal.value = false;
    selectedDeviceForEdit.value = null;
    return;
  }
  try {
    let url = '/api/devices';
    let method = 'POST';
    
    if (selectedDeviceForEdit.value) {
      url = `/api/devices/${selectedDeviceForEdit.value.id}`;
      method = 'PUT';
    }
    
    const res = await fetch(url, {
      method,
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    
    const result = await res.json();
    if (result.success) {
      showDeviceModal.value = false;
      selectedDeviceForEdit.value = null;
      await loadAllData();
    } else {
      alert(`Gagal menyimpan perangkat: ${result.message}`);
    }
  } catch (err) {
    console.error('Error saving device:', err);
    alert('Terjadi kesalahan koneksi saat menyimpan perangkat');
  }
}

async function handleDeleteDevice(deviceId: number) {
  if (!confirm('Apakah Anda yakin ingin menghapus perangkat sensor ini? Semua log data historis dan alarm terkait juga akan terhapus.')) return;
  
  // Dummy mode: simulate delete in local state
  if (isDummyMode.value) {
    devicesList.value = devicesList.value.filter((d: any) => d.id !== deviceId);
    if (selectedDeviceId.value === deviceId) {
      selectedDeviceId.value = devicesList.value[0]?.id ?? null;
    }
    return;
  }
  try {
    const res = await fetch(`/api/devices/${deviceId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const result = await res.json();
    if (result.success) {
      if (selectedDeviceId.value === deviceId) {
        selectedDeviceId.value = null;
      }
      await loadAllData();
    } else {
      alert(`Gagal menghapus: ${result.message}`);
    }
  } catch (err) {
    console.error('Error deleting device:', err);
  }
}

function openAddDeviceModal() {
  selectedDeviceForEdit.value = null;
  showDeviceModal.value = true;
}

function openEditDeviceModal(device: any) {
  selectedDeviceForEdit.value = device;
  showDeviceModal.value = true;
}

// --- Dynamic Telemetry Helpers ---
const selectedDeviceDetails = computed(() => {
  if (selectedDeviceId.value === null) return null;
  return devicesList.value.find(d => d.id === selectedDeviceId.value) || null;
});

const selectedDeviceTelemetry = computed(() => {
  if (selectedDeviceId.value === null) return null;
  return realtimeData.value.find(d => d.deviceId === selectedDeviceId.value) || null;
});

function getDeviceTelemetry(deviceId: number) {
  return realtimeData.value.find(d => d.deviceId === deviceId) || null;
}

function getDeviceStatus(deviceId: number) {
  const tel = getDeviceTelemetry(deviceId);
  const dev = devicesList.value.find(d => d.id === deviceId);
  
  if (!tel || !dev || tel.temperature === null || tel.zVelocity === null) return 'unknown';
  
  const tempLimit = dev.setpointTemp || 70;
  const zVelLimit = dev.setpointZVel || 7.1;
  const xVelLimit = dev.setpointXVel || 7.1;
  
  const t = tel.temperature || 0;
  const zv = tel.zVelocity || 0;
  const xv = tel.xVelocity || 0;
  
  if (t >= tempLimit || zv >= zVelLimit || xv >= xVelLimit) return 'critical';
  if (t >= tempLimit * 0.8 || zv >= zVelLimit * 0.7 || xv >= xVelLimit * 0.7) return 'warning';
  return 'safe';
}

function isDeviceOnline(device: any): boolean {
  if (!device || !device.connectionId) return false;
  const connections = isDummyMode.value ? DUMMY_MODBUS_CONNECTIONS : modbusConnections.value;
  const conn = connections.find((c: any) => c.id === device.connectionId);
  return conn ? conn.isOnline : false;
}

function getHintValue(val: any, decimals = 1) {
  if (val === undefined || val === null || isNaN(Number(val))) return 'N/A';
  return Number(val).toFixed(decimals);
}

function getHintClass(val: any) {
  if (val === undefined || val === null || isNaN(Number(val))) return 'hint-null';
  if (Number(val) === 0) return 'hint-zero';
  return 'hint-ok';
}

function formatDate(isoString: string) {
  if (!isoString) return '--/--/----';
  const d = new Date(isoString);
  // Tambah 7 jam (7 * 60 * 60 * 1000 ms) untuk Waktu Indonesia Barat (WIB)
  const wibDate = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return wibDate.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + wibDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

// --- Live Clock ---
const currentTime = ref('');
function updateClock() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  currentTime.value = `${dateStr} | ${timeStr}`;
}

// --- Modbus Connection Functions ---
async function fetchModbusConnections() {
  if (isDummyMode.value) {
    modbusConnections.value = DUMMY_MODBUS_CONNECTIONS;
    return;
  }
  try {
    const res = await fetch('/api/modbus/connections', { headers: getHeaders() });
    const result = await res.json();
    if (result.success) modbusConnections.value = result.data;
  } catch { /* silently fail */ }
}

async function saveModbusConnection(payload: any) {
  try {
    let url = '/api/modbus/connections';
    let method = 'POST';
    if (selectedConnectionForEdit.value) {
      url = `/api/modbus/connections/${selectedConnectionForEdit.value.id}`;
      method = 'PUT';
    }
    const res = await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(payload) });
    const result = await res.json();
    if (result.success) {
      showModbusModal.value = false;
      selectedConnectionForEdit.value = null;
      await fetchModbusConnections();
    } else {
      alert(`Gagal menyimpan: ${result.message}`);
    }
  } catch (err) {
    alert('Terjadi kesalahan koneksi');
  }
}

async function deleteModbusConnection(connId: number) {
  if (!confirm('Hapus koneksi ini? Device yang terhubung akan ter-disconnect dari koneksi ini.')) return;
  try {
    const res = await fetch(`/api/modbus/connections/${connId}`, { method: 'DELETE', headers: getHeaders() });
    const result = await res.json();
    if (result.success) {
      await fetchModbusConnections();
      await fetchDevices(); // Refresh devices since connectionId may have changed
    } else {
      alert(`Gagal menghapus: ${result.message}`);
    }
  } catch { alert('Terjadi kesalahan koneksi'); }
}

async function testModbusConnection(connId: number) {
  modbusTestResult.value[connId] = { loading: true, message: '', ok: false };
  try {
    const res = await fetch(`/api/modbus/connections/${connId}/test`, { headers: getHeaders() });
    const result = await res.json();
    modbusTestResult.value[connId] = {
      loading: false,
      message: result.message,
      ok: result.success,
    };
  } catch {
    modbusTestResult.value[connId] = { loading: false, message: 'Koneksi ke backend gagal', ok: false };
  }
}

async function saveDeviceModbusConfig(payload: any) {
  if (!selectedDeviceForRegister.value) return;
  if (isDummyMode.value) {
    const idx = devicesList.value.findIndex((d: any) => d.id === selectedDeviceForRegister.value.id);
    if (idx !== -1) {
      devicesList.value[idx] = { ...devicesList.value[idx], ...payload };
    }
    showRegisterModal.value = false;
    selectedDeviceForRegister.value = null;
    return;
  }
  try {
    const res = await fetch(`/api/devices/${selectedDeviceForRegister.value.id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      showRegisterModal.value = false;
      selectedDeviceForRegister.value = null;
      await fetchDevices();
    } else {
      alert(`Gagal menyimpan: ${result.message}`);
    }
  } catch { alert('Terjadi kesalahan koneksi'); }
}

function getConnectionName(connectionId: number | null): string {
  if (!connectionId) return '—';
  const conn = modbusConnections.value.find((c: any) => c.id === connectionId);
  return conn ? `${conn.ipAddress}:${conn.tcpPort}` : '—';
}

// --- Polling Lifecycle ---
function startPolling() {
  stopPolling();
  updateClock();
  pollInterval = setInterval(async () => {
    updateClock();
    await fetchRealtimeTelemetries();
    await fetchAlarms();
    await fetchAnalyticsSummary();
    await fetchModbusConnections();
    if (selectedDeviceId.value !== null && activePage.value === 'detail') {
      await fetchHistoricalTrend(selectedDeviceId.value);
    }
  }, 3000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// Handle Detail Sensor click from Sidebar/Overview
async function selectDevice(deviceId: number) {
  selectedDeviceId.value = deviceId;
  activePage.value = 'detail';
  await fetchHistoricalTrend(deviceId);
}

onMounted(async () => {
  updateClock();
  setInterval(updateClock, 1000);
  
  if (isLoggedIn.value) {
    activePage.value = 'overview';
    await loadAllData();
    startPolling();
  }
});

onUnmounted(() => {
  stopPolling();
});
</script>

<template>
  <!-- 1. LOGIN SCREEN -->
  <div v-if="activePage === 'login'" class="login-viewport">
    <div class="login-box glass-panel">
      <div class="logo-area">
        <div class="scada-dot pulsing"></div>
        <h2>VIBRATION<span class="accent-text">// SCADA CMS</span></h2>
      </div>
      <p class="login-sub">Condition Monitoring System - Industri 4.0</p>
      
      <div v-if="loginError" class="login-error">
        ⚠️ {{ loginError }}
      </div>
      
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="input-group">
          <label>Username</label>
          <input type="text" v-model="username" placeholder="Masukkan username (cth: admin)" required />
        </div>
        <div class="input-group">
          <label>Password</label>
          <input type="password" v-model="password" placeholder="Masukkan password (cth: adminpassword)" required />
        </div>
        <button type="submit" class="login-btn" :disabled="loginLoading">
          <span v-if="loginLoading">Menghubungkan...</span>
          <span v-else>LOG IN TO SYSTEM</span>
        </button>
      </form>
      
      <div class="login-hint">
        <p><strong>Tips Pengujian:</strong></p>
        <p>Admin: <code>admin</code> / <code>adminpassword</code></p>
        <p>User: <code>user</code> / <code>userpassword</code></p>
      </div>
    </div>
  </div>

  <!-- 2. SCADA MAIN VIEWPORT -->
  <div v-else class="scada-viewport">
    
    <!-- LEFT SIDEBAR -->
    <aside class="scada-sidebar">
      <div class="brand">
        <img :src="theme === 'dark' ? darkLogo : lightLogo" class="company-logo" alt="PT Logo" />
      </div>
      
      <nav class="nav-links">
        <button 
          @click="activePage = 'overview'" 
          class="nav-btn" 
          :class="{ active: activePage === 'overview' }"
        >
          <span class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg></span> Overview Dashboard
        </button>
        
        <button 
          @click="activePage = 'detail'" 
          class="nav-btn" 
          :class="{ active: activePage === 'detail' }"
        >
          <span class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></span> Detail Analisis
        </button>
        
        <button 
          @click="activePage = 'alarms'" 
          class="nav-btn" 
          :class="{ active: activePage === 'alarms' }"
        >
          <span class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg></span> Log Alarm 
          <span v-if="activeAlarms.length > 0" class="badge-count animate-pulse">
            {{ activeAlarms.length }}
          </span>
        </button>
        
        <button 
          @click="activePage = 'devices'" 
          class="nav-btn" 
          :class="{ active: activePage === 'devices' }"
        >
          <span class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg></span> Device Manager
        </button>

        <button
          v-if="userRole === 'admin'"
          @click="activePage = 'modbus-config'; fetchModbusConnections()"
          class="nav-btn"
          :class="{ active: activePage === 'modbus-config' }"
        >
          <span class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg></span> Modbus Config
        </button>
      </nav>
      
      <!-- Connected Devices Sublist -->
      <div class="sidebar-devices-sec">
        <h4>Telemetry List</h4>
        <div class="device-mini-list">
          <div 
            v-for="d in devicesList" 
            :key="d.id"
            @click="selectDevice(d.id)"
            class="mini-item"
            :class="{ 
              active: selectedDeviceId === d.id && activePage === 'detail', 
              'conn-ok': isDeviceOnline(d), 
              'conn-err': !isDeviceOnline(d) 
            }"
          >
            <span class="status-indicator"></span>
            <div class="meta">
              <span class="name">{{ d.namaSensor }}</span>
              <span class="loc">{{ d.lokasi }}</span>
            </div>
            <span class="mini-val text-mono" v-if="getDeviceTelemetry(d.id)">
              {{ (Math.max(getDeviceTelemetry(d.id)?.zVelocity || 0, getDeviceTelemetry(d.id)?.xVelocity || 0)).toFixed(1) }}
            </span>
          </div>
        </div>
      </div>
      
      <div class="sidebar-contact">
        <h4 class="contact-title">PT. SMARTEK SISTEM INOVASI</h4>
        <div class="contact-details">
          <p class="contact-item">
            <span class="contact-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
            </span>
            <span class="contact-text">+62 813 8585 8815</span>
          </p>
          <p class="contact-item">
            <span class="contact-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            </span>
            <span class="contact-text">arief@smartek-sistem.co.id</span>
          </p>
          <p class="contact-item">
            <span class="contact-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            </span>
            <span class="contact-text">Grand Wisata, Tambun, Bekasi</span>
          </p>
        </div>
      </div>

      <div class="user-block">
        <div class="user-info">
          <span class="role-badge" :class="userRole">{{ userRole.toUpperCase() }}</span>
          <span class="username">{{ username }}</span>
        </div>
        <button @click="handleLogout" class="btn-logout">LOGOUT</button>
      </div>
    </aside>

    <!-- RIGHT CONTAINER -->
    <div class="scada-content-container">
      
      <!-- TOP HEADER -->
      <header class="scada-header">
        <div class="header-left">
          <h2>{{ activePage.toUpperCase() }}</h2>
          <span class="server-status">
            <span class="green-dot animate-ping"></span> Live Polling OK (3s)
          </span>
        </div>

        <div class="header-center">
          <h1 class="system-main-title">Vibration Condition Monitoring Dashboard</h1>
        </div>

        <div class="header-right">
          <!-- Digital Clock -->
          <div class="clock-display text-mono">{{ currentTime }}</div>
          
          <!-- Dummy Mode Switcher -->
          <button @click="isDummyMode = !isDummyMode" class="theme-btn" :class="{ 'dummy-active': isDummyMode }">
            <span v-if="isDummyMode">
              <svg style="vertical-align: middle; margin-right: 4px;" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><path d="M10 8v8"></path><path d="M14 8v8"></path></svg> 
              DUMMY
            </span>
            <span v-else>
              <svg style="vertical-align: middle; margin-right: 4px;" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l-5.94 5.94"></path></svg> 
              LIVE
            </span>
          </button>

          <!-- Theme Switcher -->
          <button @click="theme = theme === 'dark' ? 'light' : 'dark'" class="theme-btn">
            <span v-if="theme === 'dark'">
              <svg style="vertical-align: middle; margin-right: 4px;" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              LIGHT
            </span>
            <span v-else>
              <svg style="vertical-align: middle; margin-right: 4px;" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              DARK
            </span>
          </button>
        </div>
      </header>

      <!-- DEMO MODE BANNER -->
      <div v-if="isDummyMode" class="demo-banner">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
        <span><strong>DEMO MODE AKTIF</strong> &mdash; Data simulasi, tidak terhubung ke perangkat nyata. Semua fitur dapat dieksplor secara penuh.</span>
      </div>

      <!-- MAIN SCROLLABLE CONTENT AREA -->
      <main class="scada-main-content">
        
        <!-- PAGE A: OVERVIEW DASHBOARD -->
        <section v-if="activePage === 'overview'" class="page-sec flex-col">
          <!-- Analytics counters -->
          <div class="stats-row" style="margin-bottom: 24px;">
            <div class="glass-panel stat-card">
              <span class="lbl">TOTAL PERANGKAT</span>
              <span class="val text-mono text-gradient">{{ totalDevicesCount }}</span>
            </div>
            <div class="glass-panel stat-card alarm-bg" :class="{ critical: activeAlarms.length > 0 }">
              <span class="lbl">ALARM AKTIF SAAT INI</span>
              <span class="val text-mono">{{ activeAlarms.length }}</span>
            </div>
            <div class="glass-panel stat-card">
              <span class="lbl">STATUS MONITORING</span>
              <span v-if="activeAlarms.length > 0" class="val" style="color: var(--status-critical); font-weight: 800;">SISTEM ALERT</span>
              <span v-else class="val text-gradient" style="color: var(--status-safe); font-weight: 800;">SISTEM NORMAL</span>
            </div>
          </div>
          
          <!-- 5 Parameter Comparison Cards -->
          <div class="comparison-grid" style="order: 2;">
            <div class="glass-panel comp-card">
              <h4>Velocity Z (mm/s)</h4>
              <div class="comp-list">
                <div v-for="d in devicesList" :key="'zvel-'+d.id" class="comp-bar-row">
                  <span class="comp-lbl">{{ d.namaSensor }}</span>
                  <div class="comp-bar-track">
                     <div class="comp-bar-fill" :class="getDeviceStatus(d.id)" :style="{ width: Math.min(((getDeviceTelemetry(d.id)?.zVelocity || 0) / (d.setpointZVel || 10)) * 100, 100) + '%' }"></div>
                  </div>
                  <span class="comp-val text-mono">{{ getDeviceTelemetry(d.id)?.zVelocity?.toFixed(2) || '--' }}</span>
                </div>
              </div>
            </div>
            
            <div class="glass-panel comp-card">
              <h4>Velocity X (mm/s)</h4>
              <div class="comp-list">
                <div v-for="d in devicesList" :key="'xvel-'+d.id" class="comp-bar-row">
                  <span class="comp-lbl">{{ d.namaSensor }}</span>
                  <div class="comp-bar-track">
                     <div class="comp-bar-fill" :class="getDeviceStatus(d.id)" :style="{ width: Math.min(((getDeviceTelemetry(d.id)?.xVelocity || 0) / (d.setpointXVel || 10)) * 100, 100) + '%' }"></div>
                  </div>
                  <span class="comp-val text-mono">{{ getDeviceTelemetry(d.id)?.xVelocity?.toFixed(2) || '--' }}</span>
                </div>
              </div>
            </div>

            <div class="glass-panel comp-card">
              <h4>Acceleration Z (mm/s²)</h4>
              <div class="comp-list">
                <div v-for="d in devicesList" :key="'zacc-'+d.id" class="comp-bar-row">
                  <span class="comp-lbl">{{ d.namaSensor }}</span>
                  <div class="comp-bar-track">
                     <div class="comp-bar-fill" :class="getDeviceStatus(d.id)" :style="{ width: Math.min(((getDeviceTelemetry(d.id)?.zAcceleration || 0) / (d.setpointZAcc || 10)) * 100, 100) + '%' }"></div>
                  </div>
                  <span class="comp-val text-mono">{{ getDeviceTelemetry(d.id)?.zAcceleration?.toFixed(2) || '--' }}</span>
                </div>
              </div>
            </div>

            <div class="glass-panel comp-card">
              <h4>Acceleration X (mm/s²)</h4>
              <div class="comp-list">
                <div v-for="d in devicesList" :key="'xacc-'+d.id" class="comp-bar-row">
                  <span class="comp-lbl">{{ d.namaSensor }}</span>
                  <div class="comp-bar-track">
                     <div class="comp-bar-fill" :class="getDeviceStatus(d.id)" :style="{ width: Math.min(((getDeviceTelemetry(d.id)?.xAcceleration || 0) / (d.setpointXAcc || 10)) * 100, 100) + '%' }"></div>
                  </div>
                  <span class="comp-val text-mono">{{ getDeviceTelemetry(d.id)?.xAcceleration?.toFixed(2) || '--' }}</span>
                </div>
              </div>
            </div>

            <div class="glass-panel comp-card">
              <h4>Temperature (°C)</h4>
              <div class="comp-list">
                <div v-for="d in devicesList" :key="'temp-'+d.id" class="comp-bar-row">
                  <span class="comp-lbl">{{ d.namaSensor }}</span>
                  <div class="comp-bar-track">
                     <div class="comp-bar-fill" :class="getDeviceStatus(d.id)" :style="{ width: Math.min(((getDeviceTelemetry(d.id)?.temperature || 0) / (d.setpointTemp || 70)) * 100, 100) + '%' }"></div>
                  </div>
                  <span class="comp-val text-mono">{{ getDeviceTelemetry(d.id)?.temperature?.toFixed(1) || '--' }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Grid of all devices overview cards -->
          <div class="devices-grid" style="order: 1;">
            <div 
              v-for="d in devicesList" 
              :key="d.id"
              class="glass-panel overview-device-card"
              :class="getDeviceStatus(d.id)"
            >
              <div class="card-header">
                <div>
                  <h3>{{ d.namaSensor }}</h3>
                  <span class="loc">{{ d.lokasi }}</span>
                </div>
                <div class="status-wrapper" style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
                  <span class="status-text">{{ getDeviceStatus(d.id).toUpperCase() }}</span>
                  <div class="last-update-hint" v-if="getDeviceStatus(d.id) === 'unknown' && getDeviceTelemetry(d.id)?.timestamp">
                    Last Update: {{ formatDate(getDeviceTelemetry(d.id).timestamp) }}
                  </div>
                </div>
              </div>
              
              <div class="telemetry-block" v-if="getDeviceTelemetry(d.id)">
                <div class="tel-col temp">
                  <span class="label">TEMP</span>
                  <span class="num text-mono">{{ getDeviceTelemetry(d.id).temperature?.toFixed(1) ?? '--' }} <span class="u">°C</span></span>
                </div>
                <div class="tel-col vibz">
                  <span class="label">VIB Z</span>
                  <span class="num text-mono">{{ getDeviceTelemetry(d.id).zVelocity?.toFixed(2) ?? '--' }} <span class="u">mm/s</span></span>
                </div>
                <div class="tel-col accz">
                  <span class="label">ACC Z</span>
                  <span class="num text-mono">{{ getDeviceTelemetry(d.id).zAcceleration?.toFixed(2) ?? '--' }} <span class="u">mm/s²</span></span>
                </div>
                <div class="tel-col vibx">
                  <span class="label">VIB X</span>
                  <span class="num text-mono">{{ getDeviceTelemetry(d.id).xVelocity?.toFixed(2) ?? '--' }} <span class="u">mm/s</span></span>
                </div>
                <div class="tel-col accx">
                  <span class="label">ACC X</span>
                  <span class="num text-mono">{{ getDeviceTelemetry(d.id).xAcceleration?.toFixed(2) ?? '--' }} <span class="u">mm/s²</span></span>
                </div>
              </div>
              <div class="telemetry-block empty-block" v-else>
                Belum ada data sensor terkirim
              </div>
              
              <div class="card-footer">
                <span class="slave-tag">Modbus ID: {{ d.slaveId }}</span>
                <button @click="selectDevice(d.id)" class="btn-detail">ANALISIS DETAIL ➔</button>
              </div>
            </div>
          </div>
        </section>

        <!-- PAGE B: DETAIL SENSOR VIEW -->
        <section v-else-if="activePage === 'detail'" class="page-sec">
          <div v-if="!selectedDeviceDetails" class="empty-state glass-panel">
            <span class="icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </span>
            <h3>Silakan pilih sensor pada menu sidebar untuk melakukan analisis detail</h3>
          </div>
          
          <div v-else class="detail-stack-layout">
            <!-- Top Section: Motor SVG & Analytics Cards -->
            <div class="detail-top-section">
              <div class="svg-wrapper">
                <ScadaMotorSvg 
                  :sensorName="selectedDeviceDetails.namaSensor"
                  :velocityZ="selectedDeviceTelemetry?.zVelocity"
                  :velocityX="selectedDeviceTelemetry?.xVelocity"
                  :temperature="selectedDeviceTelemetry?.temperature"
                  :setpointZ="selectedDeviceDetails.setpointZVel"
                  :setpointX="selectedDeviceDetails.setpointXVel"
                  :setpointTemp="selectedDeviceDetails.setpointTemp"
                />
              </div>
              
              <div class="detail-metrics-grid">
                <MetricCard 
                  title="Velocity Z"
                  :value="selectedDeviceTelemetry?.zVelocity"
                  unit="mm/s"
                  :setpoint="selectedDeviceDetails.setpointZVel"
                  icon="<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M2 12h4l3-9 5 18 3-9h5'/></svg>"
                />
                <MetricCard 
                  title="Velocity X"
                  :value="selectedDeviceTelemetry?.xVelocity"
                  unit="mm/s"
                  :setpoint="selectedDeviceDetails.setpointXVel"
                  icon="<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M2 12h4l3-9 5 18 3-9h5'/></svg>"
                />
                <MetricCard 
                  title="Accel Z"
                  :value="selectedDeviceTelemetry?.zAcceleration"
                  unit="mm/s²"
                  :setpoint="selectedDeviceDetails.setpointZAcc"
                  icon="<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2'/></svg>"
                />
                <MetricCard 
                  title="Accel X"
                  :value="selectedDeviceTelemetry?.xAcceleration"
                  unit="mm/s²"
                  :setpoint="selectedDeviceDetails.setpointXAcc"
                  icon="<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2'/></svg>"
                />
                <MetricCard 
                  title="Core Temp"
                  :value="selectedDeviceTelemetry?.temperature"
                  unit="°C"
                  :setpoint="selectedDeviceDetails.setpointTemp"
                  icon="<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z'/></svg>"
                  style="grid-column: span 2;"
                />
              </div>
            </div>
            
            <!-- Bottom Section: Historical Trend -->
            <div class="detail-bottom-section">
              <TrendLineChart 
                :logs="historicalLogs"
                :setpointTemp="selectedDeviceDetails.setpointTemp"
                :setpointZVel="selectedDeviceDetails.setpointZVel"
                :setpointXVel="selectedDeviceDetails.setpointXVel"
                :setpointZAcc="selectedDeviceDetails.setpointZAcc"
                :setpointXAcc="selectedDeviceDetails.setpointXAcc"
                :isDarkTheme="theme === 'dark'"
                @range-change="handleRangeChange"
              />
            </div>
          </div>
        </section>

        <!-- PAGE C: LOG ALARM -->
        <section v-else-if="activePage === 'alarms'" class="page-sec flex-col">
          <div class="alarm-view-layout">
            <!-- Active Alarms Card -->
            <div class="glass-panel table-panel">
              <div class="panel-header">
                <h3>Alarm Aktif (Butuh Konfirmasi)</h3>
                <span class="alarm-badge critical" v-if="activeAlarms.length > 0">
                  {{ activeAlarms.length }} KRITIS
                </span>
              </div>
              
              <div class="table-wrapper">
                <table class="scada-table">
                  <thead>
                    <tr>
                      <th>Waktu Terdeteksi</th>
                      <th>Objek Sensor</th>
                      <th>Parameter</th>
                      <th>Nilai Pengukuran</th>
                      <th>Batas Threshold</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="activeAlarms.length === 0">
                      <td colspan="6" class="empty-row">Kondisi sistem aman. Tidak ada alarm aktif.</td>
                    </tr>
                    <tr v-for="a in activeAlarms" :key="a.id" class="alarm-row critical">
                      <td>{{ formatDate(a.timestamp) }}</td>
                      <td><strong>{{ a.deviceName || ('Device ID: ' + a.deviceId) }}</strong></td>
                      <td class="text-mono">{{ a.parameter }}</td>
                      <td class="text-mono critical-text">{{ a.value.toFixed(2) }}</td>
                      <td class="text-mono">{{ a.threshold.toFixed(2) }}</td>
                      <td>
                        <button @click="acknowledgeAlarm(a.id)" class="btn-ack animate-pulse">
                          ACKNOWLEDGE
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Historical Alarms (Acknowledged) -->
            <div class="glass-panel table-panel">
              <div class="panel-header">
                <h3>Riwayat Alarm Terdahulu (Acknowledged)</h3>
              </div>
              
              <div class="table-wrapper">
                <table class="scada-table">
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Objek Sensor</th>
                      <th>Parameter</th>
                      <th>Nilai Pengukuran</th>
                      <th>Batas Threshold</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="alarmHistory.length === 0">
                      <td colspan="6" class="empty-row">Belum ada riwayat alarm terdahulu.</td>
                    </tr>
                    <tr v-for="a in alarmHistory" :key="a.id">
                      <td>{{ formatDate(a.timestamp) }}</td>
                      <td>{{ a.deviceName || ('Device ID: ' + a.deviceId) }}</td>
                      <td class="text-mono">{{ a.parameter }}</td>
                      <td class="text-mono">{{ a.value.toFixed(2) }}</td>
                      <td class="text-mono">{{ a.threshold.toFixed(2) }}</td>
                      <td>
                        <span class="status-badge-text health-safe">RESOLVED</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <!-- PAGE D: DEVICE MANAGER -->
        <section v-else-if="activePage === 'devices'" class="page-sec flex-col">
          <div class="glass-panel table-panel full-width">
            <div class="panel-header">
              <div class="title-meta">
                <h3>Manajemen Objek Sensor (Modbus RTU)</h3>
                <p class="subtitle">Daftarkan dan konfigurasikan setpoint alarm pada perangkat RS485</p>
              </div>
              <button 
                v-if="userRole === 'admin'"
                @click="openAddDeviceModal" 
                class="btn-add-device"
              >
                + Tambah Perangkat Baru
              </button>
            </div>
            
            <div class="table-wrapper">
              <table class="scada-table">
                <thead>
                  <tr>
                    <th>Slave ID</th>
                    <th>Nama Objek Sensor</th>
                    <th>Lokasi</th>
                    <th>Temp Limit</th>
                    <th>Vel-Z Limit</th>
                    <th>Vel-X Limit</th>
                    <th>Acc-Z Limit</th>
                    <th>Acc-X Limit</th>
                    <th v-if="userRole === 'admin'">Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="devicesList.length === 0">
                    <td colspan="9" class="empty-row">Belum ada perangkat terdaftar di sistem.</td>
                  </tr>
                  <tr v-for="d in devicesList" :key="d.id">
                    <td class="text-mono text-gradient">#{{ d.slaveId }}</td>
                    <td><strong>{{ d.namaSensor }}</strong></td>
                    <td>{{ d.lokasi }}</td>
                    <td class="text-mono">{{ d.setpointTemp }} °C</td>
                    <td class="text-mono">{{ d.setpointZVel }} mm/s</td>
                    <td class="text-mono">{{ d.setpointXVel }} mm/s</td>
                    <td class="text-mono">{{ d.setpointZAcc }} mm/s²</td>
                    <td class="text-mono">{{ d.setpointXAcc }} mm/s²</td>
                    <td v-if="userRole === 'admin'">
                      <div class="action-btns">
                        <button @click="openEditDeviceModal(d)" class="edit-btn">EDIT</button>
                        <button @click="handleDeleteDevice(d.id)" class="del-btn">HAPUS</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- PAGE E: MODBUS CONFIG -->
        <section v-else-if="activePage === 'modbus-config'" class="page-sec flex-col modbus-config-page">
          
          <!-- Section A: TCP Connections -->
          <div class="glass-panel modbus-section">
            <div class="panel-header">
              <div class="title-meta">
                <h3>Koneksi Modbus TCP</h3>
                <p class="subtitle">Kelola koneksi IP/TCP ke gateway / PLC Modbus TCP</p>
              </div>
              <button @click="selectedConnectionForEdit = null; showModbusModal = true" class="btn-add-device">
                + Tambah Koneksi TCP
              </button>
            </div>

            <!-- Empty state -->
            <div v-if="modbusConnections.length === 0" class="modbus-empty">
              <div class="modbus-empty-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
              </div>
              <p>Belum ada koneksi Modbus TCP yang dikonfigurasi</p>
              <span>Klik "Tambah Koneksi TCP" untuk memulai</span>
            </div>

            <!-- Connection Cards -->
            <div v-else class="conn-card-list">
              <div v-for="conn in modbusConnections" :key="conn.id" class="conn-card glass-panel">
                <div class="conn-card-left">
                  <div class="conn-port-badge" :class="{ 'conn-active': conn.isOnline }">
                    <span class="conn-status-dot" :class="{ 'active': conn.isOnline }"></span>
                    <span class="text-mono">{{ conn.ipAddress }}:{{ conn.tcpPort }}</span>
                  </div>
                  <div class="conn-meta">
                    <span class="conn-poll">Interval Polling: {{ conn.pollInterval }}ms &bull; Timeout: {{ conn.timeout }}ms</span>
                  </div>
                </div>
                <div class="conn-card-right">
                  <span v-if="conn.isOnline" class="badge-active" style="background: rgba(16, 185, 129, 0.1); color: var(--status-safe); border: 1px solid rgba(16, 185, 129, 0.2);">ONLINE</span>
                  <span v-else-if="conn.isActive" class="badge-inactive" style="background: rgba(239, 68, 68, 0.1); color: var(--status-critical); border: 1px solid rgba(239, 68, 68, 0.2);">OFFLINE</span>
                  <span v-else class="badge-inactive">NON-AKTIF</span>

                  <!-- Test result -->
                  <div v-if="modbusTestResult[conn.id]" class="test-result" :class="{ 'ok': modbusTestResult[conn.id].ok, 'fail': !modbusTestResult[conn.id].ok && !modbusTestResult[conn.id].loading }">
                    <span v-if="modbusTestResult[conn.id].loading">Menguji...</span>
                    <span v-else>{{ modbusTestResult[conn.id].ok ? '✓' : '✗' }} {{ modbusTestResult[conn.id].message }}</span>
                  </div>

                  <div class="action-btns">
                    <button @click="testModbusConnection(conn.id)" class="test-btn" :disabled="modbusTestResult[conn.id]?.loading">TEST</button>
                    <button @click="selectedConnectionForEdit = conn; showModbusModal = true" class="edit-btn">EDIT</button>
                    <button @click="deleteModbusConnection(conn.id)" class="del-btn">HAPUS</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Section B: Register Address Mapping -->
          <div class="glass-panel modbus-section">
            <div class="panel-header">
              <div class="title-meta">
                <h3>Mapping Register Address per Device</h3>
                <p class="subtitle">Set alamat holding register Modbus untuk setiap parameter sensor</p>
              </div>
            </div>

            <div class="table-wrapper">
              <table class="scada-table">
                <thead>
                  <tr>
                    <th>Slave ID</th>
                    <th>Nama Sensor</th>
                    <th>Koneksi</th>
                    <th>Reg. Temp</th>
                    <th>Reg. Vel-Z</th>
                    <th>Reg. Vel-X</th>
                    <th>Reg. Acc-Z</th>
                    <th>Reg. Acc-X</th>
                    <th>Data Type</th>
                    <th>Byte Order</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="devicesList.length === 0">
                    <td colspan="11" class="empty-row">Belum ada perangkat terdaftar. Tambahkan device di Device Manager terlebih dahulu.</td>
                  </tr>
                  <tr v-for="d in devicesList" :key="d.id">
                    <td class="text-mono text-gradient">#{{ d.slaveId }}</td>
                    <td><strong>{{ d.namaSensor }}</strong></td>
                    <td>
                      <span v-if="d.connectionId" class="text-mono" style="color: var(--accent-primary);">{{ getConnectionName(d.connectionId) }}</span>
                      <span v-else class="badge-unconfigured">belum dikonfigurasi</span>
                    </td>
                    <td class="text-mono">
                      <div class="reg-cell-wrapper">
                        <span class="reg-addr">
                          {{ d.regTemp !== null && d.regTemp !== undefined ? d.regTemp : '—' }}
                          <span v-if="d.regTemp !== null && d.regTemp !== undefined && d.scaleTemp !== null && d.scaleTemp !== undefined && d.scaleTemp !== 1" class="reg-scale-hint">×{{ d.scaleTemp }}</span>
                        </span>
                        <span v-if="d.regTemp !== null && d.regTemp !== undefined" class="reg-hint" :class="getHintClass(getDeviceTelemetry(d.id)?.temperature)">
                          {{ getHintValue(getDeviceTelemetry(d.id)?.temperature, 1) }}
                        </span>
                      </div>
                    </td>
                    <td class="text-mono">
                      <div class="reg-cell-wrapper">
                        <span class="reg-addr">
                          {{ d.regZVel !== null && d.regZVel !== undefined ? d.regZVel : '—' }}
                          <span v-if="d.regZVel !== null && d.regZVel !== undefined && d.scaleZVel !== null && d.scaleZVel !== undefined && d.scaleZVel !== 1" class="reg-scale-hint">×{{ d.scaleZVel }}</span>
                        </span>
                        <span v-if="d.regZVel !== null && d.regZVel !== undefined" class="reg-hint" :class="getHintClass(getDeviceTelemetry(d.id)?.zVelocity)">
                          {{ getHintValue(getDeviceTelemetry(d.id)?.zVelocity, 2) }}
                        </span>
                      </div>
                    </td>
                    <td class="text-mono">
                      <div class="reg-cell-wrapper">
                        <span class="reg-addr">
                          {{ d.regXVel !== null && d.regXVel !== undefined ? d.regXVel : '—' }}
                          <span v-if="d.regXVel !== null && d.regXVel !== undefined && d.scaleXVel !== null && d.scaleXVel !== undefined && d.scaleXVel !== 1" class="reg-scale-hint">×{{ d.scaleXVel }}</span>
                        </span>
                        <span v-if="d.regXVel !== null && d.regXVel !== undefined" class="reg-hint" :class="getHintClass(getDeviceTelemetry(d.id)?.xVelocity)">
                          {{ getHintValue(getDeviceTelemetry(d.id)?.xVelocity, 2) }}
                        </span>
                      </div>
                    </td>
                    <td class="text-mono">
                      <div class="reg-cell-wrapper">
                        <span class="reg-addr">
                          {{ d.regZAcc !== null && d.regZAcc !== undefined ? d.regZAcc : '—' }}
                          <span v-if="d.regZAcc !== null && d.regZAcc !== undefined && d.scaleZAcc !== null && d.scaleZAcc !== undefined && d.scaleZAcc !== 1" class="reg-scale-hint">×{{ d.scaleZAcc }}</span>
                        </span>
                        <span v-if="d.regZAcc !== null && d.regZAcc !== undefined" class="reg-hint" :class="getHintClass(getDeviceTelemetry(d.id)?.zAcceleration)">
                          {{ getHintValue(getDeviceTelemetry(d.id)?.zAcceleration, 2) }}
                        </span>
                      </div>
                    </td>
                    <td class="text-mono">
                      <div class="reg-cell-wrapper">
                        <span class="reg-addr">
                          {{ d.regXAcc !== null && d.regXAcc !== undefined ? d.regXAcc : '—' }}
                          <span v-if="d.regXAcc !== null && d.regXAcc !== undefined && d.scaleXAcc !== null && d.scaleXAcc !== undefined && d.scaleXAcc !== 1" class="reg-scale-hint">×{{ d.scaleXAcc }}</span>
                        </span>
                        <span v-if="d.regXAcc !== null && d.regXAcc !== undefined" class="reg-hint" :class="getHintClass(getDeviceTelemetry(d.id)?.xAcceleration)">
                          {{ getHintValue(getDeviceTelemetry(d.id)?.xAcceleration, 2) }}
                        </span>
                      </div>
                    </td>
                    <td class="text-mono">{{ d.regDataType || '—' }}</td>
                    <td class="text-mono">{{ d.regByteOrder || '—' }}</td>
                    <td>
                      <button @click="selectedDeviceForRegister = d; showRegisterModal = true" class="edit-btn">KONFIGURASI</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </section>

      </main>
    </div>
  </div>

  <!-- CRUD MODAL POPUP -->
  <DeviceModal 
    :show="showDeviceModal"
    :device="selectedDeviceForEdit"
    @close="showDeviceModal = false"
    @save="handleSaveDevice"
  />

  <!-- Modbus Connection Modal -->
  <ModbusConfigModal
    :show="showModbusModal"
    :connection="selectedConnectionForEdit"
    @close="showModbusModal = false; selectedConnectionForEdit = null"
    @save="saveModbusConnection"
  />

  <!-- Modbus Register Address Modal -->
  <ModbusRegisterModal
    :show="showRegisterModal"
    :device="selectedDeviceForRegister"
    :connections="modbusConnections"
    @close="showRegisterModal = false; selectedDeviceForRegister = null"
    @save="saveDeviceModbusConfig"
  />
</template>

<style>
/* CSS Styling for full page layout */
.login-viewport {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-space);
}

.login-box {
  width: 100%;
  max-width: 420px;
  padding: 40px;
  background: var(--bg-panel-solid);
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  box-shadow: var(--shadow-premium);
}

.login-box .logo-area {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.scada-dot {
  width: 10px;
  height: 10px;
  background: var(--accent-primary);
  border-radius: 50%;
  box-shadow: 0 0 10px var(--accent-primary);
}

.scada-dot.pulsing {
  animation: pulse-soft 1.5s infinite;
}

.login-sub {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 24px;
}

.login-error {
  background: var(--status-critical-glow);
  color: var(--status-critical);
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.15);
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 20px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-group label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.input-group input {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 12px 16px;
  border-radius: 8px;
}

.input-group input:focus {
  outline: none;
  border-color: var(--accent-primary);
}

.login-btn {
  background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
  border: none;
  color: white;
  padding: 14px;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.25);
  margin-top: 10px;
}

.login-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
}

.login-hint {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.6;
}

/* SCADA VIEWPORT LAYOUT */
.scada-viewport {
  width: 100vw;
  height: 100vh;
  display: flex;
  background-color: var(--bg-space);
  overflow: hidden;
}

.scada-sidebar {
  width: var(--sidebar-width);
  height: 100%;
  background: var(--bg-panel-solid);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  z-index: 10;
}

.scada-sidebar .brand {
  height: var(--header-height);
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--border-color);
}

.scada-sidebar .brand .company-logo {
  width: 140px;
  max-width: 90%;
  height: auto;
  object-fit: contain;
  border-radius: 6px;
  flex-shrink: 0;
}

.pulse-icon {
  width: 8px;
  height: 8px;
  background: var(--accent-cyan);
  border-radius: 50%;
  box-shadow: 0 0 10px var(--accent-cyan);
}

.nav-links {
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  padding: 12px 16px;
  border-radius: 8px;
  font-family: inherit;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  text-align: left;
  position: relative;
}

.nav-btn:hover {
  background: var(--bg-input-hover);
  color: var(--text-primary);
}

.nav-btn.active {
  background: var(--bg-input);
  color: var(--accent-primary);
  border: 1px solid var(--border-color);
}

.badge-count {
  position: absolute;
  right: 16px;
  background: var(--status-critical);
  color: white;
  font-size: 0.65rem;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
}

/* Sidebar mini telemetry view */
.sidebar-devices-sec {
  flex-grow: 1;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-devices-sec h4 {
  font-size: 0.7rem;
  font-weight: 800;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
  padding-left: 8px;
}

.device-mini-list {
  flex-grow: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 4px;
}

.mini-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
}

.mini-item:hover {
  background: var(--bg-input-hover);
}

.mini-item.active {
  background: var(--bg-input);
  border-color: var(--border-color);
}

.mini-item .status-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.mini-item.conn-ok .status-indicator {
  background-color: var(--status-safe);
  box-shadow: 0 0 6px var(--status-safe);
}

.mini-item.conn-err .status-indicator {
  background-color: var(--status-critical);
  box-shadow: 0 0 6px var(--status-critical);
}

.mini-item.safe .status-indicator {
  background-color: var(--status-safe);
  box-shadow: 0 0 6px var(--status-safe);
}

.mini-item.warning .status-indicator {
  background-color: var(--status-warning);
  box-shadow: 0 0 6px var(--status-warning);
}

.mini-item.critical .status-indicator {
  background-color: var(--status-critical);
  box-shadow: 0 0 6px var(--status-critical);
}

.mini-item .meta {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: hidden;
}

.mini-item .meta .name {
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-item .meta .loc {
  font-size: 0.65rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-item .mini-val {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.user-block {
  padding: 20px;
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.role-badge {
  font-size: 0.6rem;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
}

.role-badge.admin {
  background: var(--status-warning-glow);
  color: var(--status-warning);
}

.role-badge.user {
  background: var(--status-safe-glow);
  color: var(--status-safe);
}

.username {
  font-size: 0.85rem;
  font-weight: 700;
}

.btn-logout {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 8px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-logout:hover {
  background: var(--status-critical-glow);
  color: var(--status-critical);
  border-color: rgba(239, 68, 68, 0.2);
}

/* SIDEBAR CONTACT BRANDING */
.sidebar-contact {
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
  background: rgba(13, 25, 38, 0.1);
}

.scada-sidebar .sidebar-contact .contact-title {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.sidebar-contact .contact-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sidebar-contact .contact-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.68rem;
  color: var(--text-muted);
  line-height: 1.3;
  margin: 0;
}

.sidebar-contact .contact-icon {
  flex-shrink: 0;
  width: 14px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 3px;
  color: var(--text-muted);
}

.sidebar-contact .contact-icon svg {
  stroke: currentColor;
}

.sidebar-contact .contact-text {
  word-break: break-word;
}

/* SCADA CONTENT GRID CONTAINER */
.scada-content-container {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.scada-header {
  height: var(--header-height);
  padding: 0 32px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-panel-solid);
  flex-shrink: 0;
}

.scada-header h2 {
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  display: inline-block;
  margin-right: 16px;
}

.server-status {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.green-dot {
  width: 6px;
  height: 6px;
  background: var(--status-safe);
  border-radius: 50%;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.clock-display {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  padding: 6px 14px;
  border-radius: 8px;
  letter-spacing: 0.5px;
}

.theme-btn {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 8px 12px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.theme-btn:hover {
  background: var(--bg-input-hover);
  color: var(--text-primary);
}

.dummy-active {
  background: rgba(245, 158, 11, 0.12) !important;
  border-color: rgba(245, 158, 11, 0.5) !important;
  color: #f59e0b !important;
}

.demo-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 32px;
  background: linear-gradient(90deg, rgba(245, 158, 11, 0.10) 0%, rgba(245, 158, 11, 0.04) 100%);
  border-bottom: 1px solid rgba(245, 158, 11, 0.25);
  color: #f59e0b;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.2px;
  flex-shrink: 0;
}

.demo-banner strong {
  font-weight: 800;
  letter-spacing: 0.5px;
}

/* MAIN SCROLLABLE VIEWPORT */
.scada-main-content {
  flex-grow: 1;
  padding: 32px;
  overflow-y: auto;
  background-color: var(--bg-space);
}

.page-sec {
  width: 100%;
  height: 100%;
  display: flex;
  gap: 24px;
}

.page-sec.flex-col {
  flex-direction: column;
}

/* OVERVIEW DASHBOARD SPECIFICS */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.stat-card {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-card .lbl {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.stat-card .val {
  font-size: 2.2rem;
  font-weight: 800;
  line-height: 1;
}

.alarm-bg.critical {
  background: var(--status-critical-glow);
  border-color: rgba(239, 68, 68, 0.2);
  color: var(--status-critical);
}

.devices-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 24px;
}

.overview-device-card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
}

.overview-device-card.critical {
  border-color: rgba(239, 68, 68, 0.2);
}

.overview-device-card.warning {
  border-color: rgba(245, 158, 11, 0.2);
}

.overview-device-card .card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.overview-device-card h3 {
  font-size: 1rem;
  font-weight: 700;
}

.overview-device-card .loc {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.overview-device-card .status-text {
  font-size: 0.65rem;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
}

.overview-device-card.safe .status-text {
  color: var(--status-safe);
  background: var(--status-safe-glow);
}
.overview-device-card.warning .status-text {
  color: var(--status-warning);
  background: var(--status-warning-glow);
}
.overview-device-card.critical .status-text {
  color: var(--status-critical);
  background: var(--status-critical-glow);
}

.telemetry-block {
  display: grid;
  grid-template-columns: auto 1fr 1fr;
  grid-template-areas: 
    "temp vibz accz"
    "temp vibx accx";
  gap: 12px;
  background: var(--bg-input);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.telemetry-block.empty-block {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: var(--text-muted);
  height: 62px;
}

.telemetry-block .tel-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tel-col.temp {
  grid-area: temp;
  justify-content: center;
  border-right: 1px solid var(--border-color);
  padding-right: 12px;
}

.tel-col.vibz { grid-area: vibz; }
.tel-col.accz { grid-area: accz; }
.tel-col.vibx { grid-area: vibx; }
.tel-col.accx { grid-area: accx; }

.telemetry-block .tel-col .label {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--text-muted);
}

.telemetry-block .tel-col .num {
  font-size: 0.95rem;
  font-weight: 700;
}

.telemetry-block .tel-col .num .u {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.overview-device-card .card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
}

.slave-tag {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-weight: 500;
}

.btn-detail {
  background: transparent;
  border: none;
  color: var(--accent-primary);
  font-size: 0.75rem;
  font-weight: 800;
  cursor: pointer;
}

.btn-detail:hover {
  text-decoration: underline;
}

/* SENSORS DETAIL VIEW STACK LAYOUT */
.detail-stack-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.detail-top-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 1024px) {
  .detail-top-section {
    grid-template-columns: 1fr;
    max-height: unset;
  }
}

.detail-metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.svg-wrapper {
  width: 100%;
  height: 100%;
}

.detail-bottom-section {
  width: 100%;
  min-height: 40vh;
  flex: 1;
}

/* COMPARISON GRID CARDS */
.comparison-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

@media (max-width: 1200px) {
  .comparison-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.comp-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.comp-card h4 {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 8px;
}

.comp-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.comp-bar-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.comp-lbl {
  font-size: 0.65rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.comp-bar-track {
  width: 100%;
  height: 6px;
  background: var(--bg-input);
  border-radius: 3px;
  overflow: hidden;
}

.comp-bar-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--status-safe);
  transition: width 0.3s ease;
}

.comp-bar-fill.warning {
  background: var(--status-warning);
}

.comp-bar-fill.critical {
  background: var(--status-critical);
}

.comp-val {
  font-size: 0.75rem;
  font-weight: 700;
  align-self: flex-end;
}

/* LOG ALARM SPECIFICS */
.alarm-view-layout {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.table-panel {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.table-panel.full-width {
  width: 100%;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h3 {
  font-size: 1.1rem;
  font-weight: 700;
}

.panel-header .subtitle {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

.alarm-badge {
  font-size: 0.7rem;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 4px;
}

.alarm-badge.critical {
  background: var(--status-critical-glow);
  color: var(--status-critical);
}

.table-wrapper {
  overflow-x: auto;
}

.scada-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.scada-table th {
  padding: 12px 16px;
  border-bottom: 2px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
}

.scada-table td {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.85rem;
}

.scada-table tbody tr:hover {
  background: var(--bg-input-hover);
}

.scada-table .empty-row {
  text-align: center;
  color: var(--text-muted);
  padding: 40px;
}

.alarm-row.critical {
  background: rgba(239, 68, 68, 0.03);
}

.critical-text {
  color: var(--status-critical);
  font-weight: 700;
}

.btn-ack {
  background: var(--status-critical);
  border: none;
  color: white;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 800;
  cursor: pointer;
}

.btn-ack:hover {
  background: #dc2626;
}

.btn-add-device {
  background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
  border: none;
  color: white;
  padding: 10px 18px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.2);
}

.btn-add-device:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.35);
}

.action-btns {
  display: flex;
  gap: 8px;
}

.edit-btn, .del-btn {
  background: transparent;
  border: 1px solid var(--border-color);
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  cursor: pointer;
}

.edit-btn {
  color: var(--accent-primary);
  border-color: rgba(99, 102, 241, 0.2);
}

.edit-btn:hover {
  background: var(--primary-glow);
}

.del-btn {
  color: var(--status-critical);
  border-color: rgba(239, 68, 68, 0.2);
}

.del-btn:hover {
  background: var(--status-critical-glow);
}

/* ========================
   MODBUS CONFIG PAGE STYLES
   ======================== */
.modbus-config-page {
  gap: 20px;
}

.modbus-section {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Empty state */
.modbus-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px;
  color: var(--text-secondary);
}

.modbus-empty-icon {
  color: var(--text-muted);
  opacity: 0.4;
  margin-bottom: 8px;
}

.modbus-empty p { font-weight: 600; font-size: 0.95rem; }
.modbus-empty span { font-size: 0.8rem; color: var(--text-muted); }

/* Connection Cards */
.conn-card-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.conn-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-radius: 12px;
  gap: 16px;
  transition: border-color 0.2s;
}

.conn-card.conn-active-card { border-color: rgba(0, 210, 255, 0.3); }

.conn-card-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.conn-port-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 700;
  min-width: 100px;
}

.conn-port-badge.conn-active {
  border-color: rgba(0, 210, 255, 0.35);
  background: rgba(0, 210, 255, 0.06);
}

.conn-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
  flex-shrink: 0;
}

.conn-status-dot.active {
  background: var(--status-safe);
  box-shadow: 0 0 8px var(--status-safe);
  animation: pulse-soft 2s infinite;
}

.conn-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.conn-settings {
  font-size: 0.9rem;
  color: var(--text-primary);
  font-weight: 600;
}

.conn-poll {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.conn-card-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.badge-active {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 1px;
  padding: 3px 10px;
  border-radius: 99px;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.4);
  color: var(--status-safe);
}

.badge-inactive {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 1px;
  padding: 3px 10px;
  border-radius: 99px;
  background: rgba(148, 163, 184, 0.1);
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: var(--text-muted);
}

.badge-unconfigured {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  color: var(--status-warning);
  font-style: italic;
}

.test-result {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  max-width: 280px;
  text-align: right;
  line-height: 1.4;
}

.test-result.ok {
  color: var(--status-safe);
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.test-result.fail {
  color: var(--status-critical);
  background: var(--status-critical-glow);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.test-btn {
  padding: 6px 14px;
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid rgba(0, 210, 255, 0.25);
  background: rgba(0, 210, 255, 0.08);
  color: var(--accent-primary);
  transition: all 0.15s;
}

.test-btn:hover:not(:disabled) {
  background: rgba(0, 210, 255, 0.15);
  border-color: rgba(0, 210, 255, 0.5);
}

.test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.reg-cell-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.reg-addr {
  font-size: 0.9rem;
  font-weight: 500;
}

.reg-scale-hint {
  font-size: 0.7rem;
  color: var(--accent-cyan);
  background: rgba(0, 210, 255, 0.08);
  padding: 1px 4px;
  border-radius: 4px;
  margin-left: 5px;
  font-weight: 700;
  border: 1px solid rgba(0, 210, 255, 0.15);
  display: inline-block;
  vertical-align: middle;
}

.reg-hint {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 4px;
  display: inline-block;
  font-family: 'JetBrains Mono', monospace;
}

.hint-ok {
  color: var(--accent-cyan);
  background: rgba(0, 243, 255, 0.08);
  border: 1px solid rgba(0, 243, 255, 0.15);
}

.hint-zero {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.08);
  border: 1px solid rgba(251, 191, 36, 0.15);
}

.hint-null {
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.offline-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 16px 0;
  text-align: center;
  color: var(--text-muted);
}

.offline-placeholder svg {
  color: var(--status-critical);
  margin-bottom: 8px;
  opacity: 0.8;
}

.offline-placeholder p {
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 4px;
}

.offline-placeholder .last-update {
  font-size: 0.75rem;
  color: var(--accent-cyan);
  font-family: 'JetBrains Mono', monospace;
}

.last-update-hint {
  font-size: 0.68rem;
  color: var(--accent-cyan);
  margin-top: 4px;
  font-family: 'JetBrains Mono', monospace;
  opacity: 0.85;
  font-weight: 500;
  letter-spacing: 0.2px;
}
</style>
