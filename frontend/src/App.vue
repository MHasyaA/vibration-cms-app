<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';

interface VibrationLog {
  id: number;
  sensorName: string;
  vibrationValue: number;
  timestamp: string;
}

const logs = ref<VibrationLog[]>([]);
const sensorName = ref('Sensor-Alpha');
const vibrationValue = ref(1.8);
const loading = ref(false);
const submitLoading = ref(false);
const error = ref<string | null>(null);

// Thresholds for vibration severity (mm/s RMS)
const THRESHOLD_WARNING = 3.5;
const THRESHOLD_CRITICAL = 7.1;

// Fetch vibration logs from the backend via Nginx reverse proxy
async function fetchLogs() {
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch('/api/vibration?limit=20');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    if (result.success) {
      logs.value = result.data;
    } else {
      throw new Error(result.message || 'Failed to fetch logs');
    }
  } catch (err: any) {
    error.value = err.message || 'Gagal terhubung ke API backend.';
  } finally {
    loading.value = false;
  }
}

// Submit new simulated vibration reading
async function submitData() {
  if (!sensorName.value || vibrationValue.value === null) return;
  submitLoading.value = true;
  error.value = null;
  try {
    const response = await fetch('/api/vibration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sensorName: sensorName.value,
        vibrationValue: Number(vibrationValue.value),
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    if (result.success) {
      // Refresh list immediately
      await fetchLogs();
      // Generate slightly randomized value for next simulation
      vibrationValue.value = Number((Math.random() * 8.5).toFixed(2));
    } else {
      throw new Error(result.message || 'Failed to record data');
    }
  } catch (err: any) {
    error.value = err.message || 'Gagal mengirim data ke backend.';
  } finally {
    submitLoading.value = false;
  }
}

// Computed stats
const latestReading = computed(() => logs.value[0] || null);

const statusClass = computed(() => {
  if (!latestReading.value) return 'status-unknown';
  const val = latestReading.value.vibrationValue;
  if (val >= THRESHOLD_CRITICAL) return 'status-critical';
  if (val >= THRESHOLD_WARNING) return 'status-warning';
  return 'status-safe';
});

const statusText = computed(() => {
  if (!latestReading.value) return 'No Data';
  const val = latestReading.value.vibrationValue;
  if (val >= THRESHOLD_CRITICAL) return 'CRITICAL';
  if (val >= THRESHOLD_WARNING) return 'WARNING';
  return 'SAFE';
});

const maxVibration = computed(() => {
  if (logs.value.length === 0) return 0;
  return Math.max(...logs.value.map(l => l.vibrationValue));
});

// Auto refresh every 3 seconds
let refreshInterval: any;
onMounted(() => {
  fetchLogs();
  refreshInterval = setInterval(fetchLogs, 3000);
});

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval);
});

function formatTime(isoString: string) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getSeverityBadgeClass(val: number) {
  if (val >= THRESHOLD_CRITICAL) return 'badge-critical';
  if (val >= THRESHOLD_WARNING) return 'badge-warning';
  return 'badge-safe';
}
</script>

<template>
  <div class="cms-container">
    <!-- Navbar / Header -->
    <header class="cms-header">
      <div class="logo-area">
        <div class="pulse-icon"></div>
        <h1>VIBRA-SENSE <span class="accent-text">// CMS</span></h1>
      </div>
      <div class="status-indicator">
        <span class="live-dot"></span>
        <span class="live-text">MONITORING AKTIF (3s Auto-Refresh)</span>
        <button @click="fetchLogs" class="btn-refresh" :disabled="loading">
          <span :class="{ 'spinning': loading }">🔄</span> Refresh
        </button>
      </div>
    </header>

    <!-- Main Content Layout -->
    <main class="cms-main">
      <!-- Error Banner -->
      <div v-if="error" class="error-banner">
        <span class="error-icon">⚠️</span>
        <p>{{ error }}</p>
      </div>

      <!-- Quick Metrics Cards -->
      <section class="metrics-grid">
        <!-- Card 1: Status Terbaru -->
        <div class="metric-card glow-card" :class="statusClass">
          <h3>Vibrasi Terkini</h3>
          <div class="value-display">
            <span class="number">{{ latestReading ? latestReading.vibrationValue.toFixed(2) : '--' }}</span>
            <span class="unit">mm/s</span>
          </div>
          <div class="status-badge-container">
            <span class="status-label">Status:</span>
            <span class="status-badge">{{ statusText }}</span>
          </div>
          <div class="meta-info" v-if="latestReading">
            Device: <strong>{{ latestReading.sensorName }}</strong> @ {{ formatTime(latestReading.timestamp) }}
          </div>
        </div>

        <!-- Card 2: Peak Vibration -->
        <div class="metric-card">
          <h3>Peak Vibration (Log)</h3>
          <div class="value-display">
            <span class="number text-gradient">{{ maxVibration.toFixed(2) }}</span>
            <span class="unit">mm/s</span>
          </div>
          <p class="description text-muted">Nilai getaran tertinggi yang terekam dalam sesi log saat ini.</p>
        </div>

        <!-- Card 3: Standar ISO 10816 -->
        <div class="metric-card">
          <h3>Panduan Threshold (ISO 10816)</h3>
          <div class="threshold-legend">
            <div class="legend-item">
              <span class="legend-dot dot-safe"></span>
              <span class="legend-label">Safe (&lt; 3.5 mm/s)</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot dot-warning"></span>
              <span class="legend-label">Warning (3.5 - 7.1 mm/s)</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot dot-critical"></span>
              <span class="legend-label">Critical (&gt; 7.1 mm/s)</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Interactive Area -->
      <section class="content-grid">
        <!-- Ingestion Simulator Form -->
        <div class="panel-card">
          <div class="panel-header">
            <h2>Simulator Sensor Vibrasi</h2>
            <p class="panel-subtitle">Kirim data getaran untuk menguji arsitektur end-to-end</p>
          </div>
          <form @submit.prevent="submitData" class="sim-form">
            <div class="form-group">
              <label for="sensor">Nama Sensor / Peralatan</label>
              <input 
                type="text" 
                id="sensor" 
                v-model="sensorName" 
                placeholder="cth: Pump-01A"
                required
              />
            </div>
            <div class="form-group">
              <label for="vibration">Nilai Vibrasi (Velocity mm/s RMS)</label>
              <div class="input-range-container">
                <input 
                  type="range" 
                  id="vibration-range"
                  v-model="vibrationValue" 
                  min="0.1" 
                  max="12.0" 
                  step="0.05"
                  class="range-slider"
                />
                <div class="input-number-wrapper">
                  <input 
                    type="number" 
                    id="vibration"
                    v-model="vibrationValue" 
                    min="0.1" 
                    max="20.0" 
                    step="0.01"
                    required
                  />
                  <span class="input-unit">mm/s</span>
                </div>
              </div>
            </div>
            <button type="submit" class="btn-submit" :disabled="submitLoading">
              <span v-if="submitLoading">Mengirim...</span>
              <span v-else>Kirim Data Sensor 🚀</span>
            </button>
          </form>
        </div>

        <!-- Historical Logs Table -->
        <div class="panel-card flex-grow">
          <div class="panel-header">
            <h2>Log Histori Sensor</h2>
            <p class="panel-subtitle">20 data getaran teraktif yang tersimpan di PostgreSQL</p>
          </div>
          <div class="table-container">
            <div v-if="logs.length === 0 && !loading" class="empty-state">
              Belum ada data sensor terkirim. Gunakan simulator di sebelah kiri untuk mengirim data getaran pertama.
            </div>
            <table v-else class="log-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Nama Sensor</th>
                  <th>Vibrasi</th>
                  <th>Tingkat Bahaya</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="log in logs" :key="log.id" class="table-row">
                  <td class="time-col">{{ formatTime(log.timestamp) }}</td>
                  <td class="sensor-col"><strong>{{ log.sensorName }}</strong></td>
                  <td class="value-col font-mono">{{ log.vibrationValue.toFixed(2) }} mm/s</td>
                  <td class="status-col">
                    <span class="badge" :class="getSeverityBadgeClass(log.vibrationValue)">
                      {{ log.vibrationValue >= THRESHOLD_CRITICAL ? 'Critical' : log.vibrationValue >= THRESHOLD_WARNING ? 'Warning' : 'Safe' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style>
/* Modern Elegant HSL CSS Design System (Custom Dark Mode) */
:root {
  --bg-main: #0a0d16;
  --bg-card: rgba(18, 24, 41, 0.75);
  --bg-input: #151a2d;
  --border-color: rgba(255, 255, 255, 0.08);
  --text-main: #f3f4f6;
  --text-muted: #9ca3af;
  
  --primary: #6366f1;
  --primary-glow: rgba(99, 102, 241, 0.15);
  --accent: #a855f7;

  /* HSL Colors for Statuses */
  --color-safe: 142, 72%, 50%;       /* Emerald */
  --color-warning: 38, 92%, 50%;     /* Amber */
  --color-critical: 350, 89%, 60%;   /* Rose */
}

/* Global resets for standalone page styling */
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background-color: var(--bg-main);
  color: var(--text-main);
  font-family: 'Outfit', 'Inter', system-ui, -apple-system, sans-serif;
  overflow-x: hidden;
}

#app {
  width: 100%;
  min-height: 100vh;
}

/* Typography Helper */
.text-gradient {
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Container */
.cms-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* Header Section */
.cms-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 24px;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-area h1 {
  font-size: 1.5rem;
  margin: 0;
  font-weight: 800;
  letter-spacing: 1px;
}

.accent-text {
  background: linear-gradient(135deg, #818cf8, #c084fc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.pulse-icon {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: var(--primary);
  box-shadow: 0 0 12px var(--primary);
  animation: pulse-glow 2s infinite;
}

@keyframes pulse-glow {
  0% {
    transform: scale(0.9);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.15);
    opacity: 1;
    box-shadow: 0 0 16px var(--primary);
  }
  100% {
    transform: scale(0.9);
    opacity: 0.6;
  }
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: rgba(255, 255, 255, 0.03);
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid var(--border-color);
}

.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: hsl(var(--color-safe));
  box-shadow: 0 0 8px hsl(var(--color-safe));
}

.live-text {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}

.btn-refresh {
  background: none;
  border: none;
  color: var(--primary);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-refresh:hover:not(:disabled) {
  background-color: rgba(99, 102, 241, 0.1);
  color: #818cf8;
}

.btn-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinning {
  display: inline-block;
  animation: spin 1s infinite linear;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

/* Error Banner */
.error-banner {
  background: rgba(244, 63, 94, 0.15);
  border: 1px solid rgba(244, 63, 94, 0.3);
  color: #fda4af;
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.error-banner p {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
}

/* Metrics Grid */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 28px;
}

.metric-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 160px;
  position: relative;
  overflow: hidden;
  transition: transform 0.3s, box-shadow 0.3s;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.3);
}

.metric-card h3 {
  margin: 0 0 16px 0;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-muted);
}

.value-display {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.value-display .number {
  font-size: 3rem;
  font-weight: 800;
  letter-spacing: -1px;
  line-height: 1;
}

.value-display .unit {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-muted);
}

/* Status Cards & Glowing border classes */
.glow-card::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
}

.status-safe::after {
  background: linear-gradient(90deg, hsl(var(--color-safe)), #34d399);
}
.status-safe {
  box-shadow: 0 0 15px rgba(16, 185, 129, 0.05), inset 0 0 12px rgba(16, 185, 129, 0.02);
}

.status-warning::after {
  background: linear-gradient(90deg, hsl(var(--color-warning)), #fbbf24);
}
.status-warning {
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.1), inset 0 0 12px rgba(245, 158, 11, 0.02);
}

.status-critical::after {
  background: linear-gradient(90deg, hsl(var(--color-critical)), #fb7185);
}
.status-critical {
  box-shadow: 0 0 30px rgba(244, 63, 94, 0.2), inset 0 0 12px rgba(244, 63, 94, 0.04);
}

.status-badge-container {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
}

.status-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
}

.status-badge {
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  padding: 4px 10px;
  border-radius: 12px;
  text-transform: uppercase;
}

.status-safe .status-badge {
  background-color: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.status-warning .status-badge {
  background-color: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.status-critical .status-badge {
  background-color: rgba(244, 63, 94, 0.2);
  color: #fca5a5;
  animation: pulse-critical-bg 1.5s infinite;
}

@keyframes pulse-critical-bg {
  0%, 100% { opacity: 0.9; }
  50% { opacity: 1; box-shadow: 0 0 10px rgba(244, 63, 94, 0.3); }
}

.meta-info {
  margin-top: 12px;
  font-size: 0.7rem;
  color: var(--text-muted);
}

.description {
  margin: 8px 0 0 0;
  font-size: 0.75rem;
  line-height: 1.4;
}

/* ISO Threshold Legend styles */
.threshold-legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot-safe { background-color: hsl(var(--color-safe)); box-shadow: 0 0 8px hsl(var(--color-safe)); }
.dot-warning { background-color: hsl(var(--color-warning)); box-shadow: 0 0 8px hsl(var(--color-warning)); }
.dot-critical { background-color: hsl(var(--color-critical)); box-shadow: 0 0 8px hsl(var(--color-critical)); }

.legend-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
}

/* Panels section */
.content-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}

.panel-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  padding: 28px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  flex: 1;
  min-width: 320px;
  display: flex;
  flex-direction: column;
}

.flex-grow {
  flex: 1.8;
  min-width: 450px;
}

.panel-header {
  margin-bottom: 24px;
}

.panel-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0 0 6px 0;
}

.panel-subtitle {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0;
}

/* Simulator Form styles */
.sim-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  text-transform: uppercase;
}

.form-group input[type="text"] {
  background-color: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-main);
  padding: 12px 14px;
  font-size: 0.9rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input[type="text"]:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-glow);
  outline: none;
}

.input-range-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.range-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  background: var(--bg-input);
  border-radius: 3px;
  outline: none;
}

.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
  box-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
  transition: transform 0.1s;
}

.range-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.input-number-wrapper {
  display: flex;
  align-items: center;
  position: relative;
}

.form-group input[type="number"] {
  background-color: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-main);
  padding: 10px 12px;
  width: 100%;
  font-size: 0.9rem;
  font-family: monospace;
  box-sizing: border-box;
}

.form-group input[type="number"]:focus {
  border-color: var(--primary);
  outline: none;
}

.input-unit {
  position: absolute;
  right: 12px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
}

.btn-submit {
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 700;
  padding: 14px;
  margin-top: 12px;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.25);
}

.btn-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* History logs table styles */
.table-container {
  flex-grow: 1;
  overflow-y: auto;
  max-height: 380px;
}

.empty-state {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.85rem;
  padding: 40px 20px;
  border: 1px dashed var(--border-color);
  border-radius: 12px;
  background-color: rgba(255, 255, 255, 0.01);
}

.log-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.log-table th {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.5px;
  padding: 10px 14px;
  border-bottom: 2px solid var(--border-color);
}

.log-table td {
  padding: 12px 14px;
  font-size: 0.85rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.table-row {
  transition: background-color 0.2s;
}

.table-row:hover {
  background-color: rgba(255, 255, 255, 0.02);
}

.time-col {
  color: var(--text-muted);
  font-size: 0.75rem;
}

.value-col {
  font-weight: 600;
}

/* Badges severity classes */
.badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  display: inline-block;
}

.badge-safe {
  background-color: rgba(16, 185, 129, 0.12);
  color: #34d399;
}

.badge-warning {
  background-color: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.badge-critical {
  background-color: rgba(244, 63, 94, 0.15);
  color: #f43f5e;
}
</style>
