<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import apexchart from 'vue3-apexcharts';

const props = defineProps<{
  logs: Array<{
    timestamp: string;
    temperature: number;
    zVelocity: number;
    xVelocity: number;
    zAcceleration: number;
    xAcceleration: number;
  }>;
  setpointTemp: number | null | undefined;
  setpointZVel: number | null | undefined;
  setpointXVel: number | null | undefined;
  setpointZAcc: number | null | undefined;
  setpointXAcc: number | null | undefined;
  isDarkTheme: boolean;
}>();

const emit = defineEmits<{
  (e: 'range-change', payload: { start?: string; end?: string }): void;
}>();

type TabType = 'velZ' | 'velX' | 'accZ' | 'accX' | 'temp';
const activeTab = ref<TabType>('velZ');

const timeRange = ref<'last_hour' | 'last_day' | 'last_week' | 'last_month' | 'custom'>('last_hour');
const customStart = ref('');
const customEnd = ref('');

function applyDateRange() {
  let start: string | undefined = undefined;
  let end: string | undefined = undefined;
  
  const now = new Date();
  if (timeRange.value === 'last_hour') {
    start = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  } else if (timeRange.value === 'last_day') {
    start = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  } else if (timeRange.value === 'last_week') {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  } else if (timeRange.value === 'last_month') {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  } else if (timeRange.value === 'custom') {
    if (customStart.value) start = new Date(customStart.value).toISOString();
    if (customEnd.value) end = new Date(customEnd.value).toISOString();
  }
  
  emit('range-change', { start, end });
}

watch(timeRange, (val) => {
  if (val !== 'custom') applyDateRange();
});

const sortedLogs = computed(() => {
  return [...props.logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
});

function exportToCSV() {
  if (props.logs.length === 0) return;
  
  const headers = ['Timestamp', 'Core Temperature (°C)', 'Z-Axis Velocity (mm/s)', 'X-Axis Velocity (mm/s)', 'Z-Axis Acceleration (mm/s²)', 'X-Axis Acceleration (mm/s²)'];
  
  const rows = sortedLogs.value.map(log => {
    return [
      `"${new Date(log.timestamp).toLocaleString('id-ID')}"`,
      log.temperature.toFixed(2),
      log.zVelocity.toFixed(2),
      log.xVelocity.toFixed(2),
      log.zAcceleration.toFixed(2),
      log.xAcceleration.toFixed(2)
    ].join(',');
  });
  
  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `scada_trend_data.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Timestamps mapped to readable locale strings
const categories = computed(() => {
  return sortedLogs.value.map((log) => {
    const d = new Date(log.timestamp);
    return d.toLocaleString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  });
});

const seriesData = computed(() => {
  return sortedLogs.value.map(l => {
    switch(activeTab.value) {
      case 'velZ': return Number(l.zVelocity.toFixed(2));
      case 'velX': return Number(l.xVelocity.toFixed(2));
      case 'accZ': return Number(l.zAcceleration.toFixed(2));
      case 'accX': return Number(l.xAcceleration.toFixed(2));
      case 'temp': return Number(l.temperature.toFixed(1));
      default: return 0;
    }
  });
});

const stats = computed(() => {
  const data = seriesData.value;
  if (data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const avg = data.reduce((a, b) => a + b, 0) / data.length;
  return { min, max, avg: Number(avg.toFixed(2)) };
});

const series = computed(() => {
  let name = '';
  switch(activeTab.value) {
    case 'velZ': name = 'Z-Axis Velocity'; break;
    case 'velX': name = 'X-Axis Velocity'; break;
    case 'accZ': name = 'Z-Axis Acceleration'; break;
    case 'accX': name = 'X-Axis Acceleration'; break;
    case 'temp': name = 'Core Temperature'; break;
  }
  return [{ name, data: seriesData.value }];
});

const yUnit = computed(() => {
  if (activeTab.value.startsWith('vel')) return 'mm/s';
  if (activeTab.value.startsWith('acc')) return 'mm/s²';
  return '°C';
});

// Dynamic limit annotations based on setpoints
const yAnnotations = computed(() => {
  const annotations: any[] = [];
  
  let limitValue = 0;
  let limitLabel = '';

  switch(activeTab.value) {
    case 'velZ': limitValue = props.setpointZVel || 7.1; limitLabel = 'Z-Vel Limit'; break;
    case 'velX': limitValue = props.setpointXVel || 7.1; limitLabel = 'X-Vel Limit'; break;
    case 'accZ': limitValue = props.setpointZAcc || 10.0; limitLabel = 'Z-Acc Limit'; break;
    case 'accX': limitValue = props.setpointXAcc || 10.0; limitLabel = 'X-Acc Limit'; break;
    case 'temp': limitValue = props.setpointTemp || 70.0; limitLabel = 'Temp Limit'; break;
  }

  // 1. Setpoint Annotation
  annotations.push({
    y: limitValue,
    borderColor: '#ef4444',
    borderWidth: 2,
    strokeDashArray: 4,
    label: {
      borderColor: '#ef4444',
      style: { color: '#fff', background: '#ef4444', fontWeight: 600, fontFamily: 'Outfit, sans-serif' },
      text: `${limitLabel}: ${limitValue}`,
    },
  });

  // Include min/avg/max if stats exist
  if (stats.value) {
    const { min, max, avg } = stats.value;

    // 2. Max Annotation (Orange)
    annotations.push({
      y: max,
      borderColor: '#f97316', // Orange-500
      borderWidth: 2,
      strokeDashArray: 2,
      label: {
        borderColor: '#f97316',
        position: 'left',
        textAnchor: 'start',
        style: { color: '#fff', background: '#f97316', fontWeight: 600, fontFamily: 'Outfit, sans-serif' },
        text: `Max: ${max}`,
      },
    });

    // 3. Avg Annotation (Blue)
    annotations.push({
      y: avg,
      borderColor: '#0ea5e9', // Sky-500
      borderWidth: 2,
      strokeDashArray: 2,
      label: {
        borderColor: '#0ea5e9',
        position: 'left',
        textAnchor: 'start',
        style: { color: '#fff', background: '#0ea5e9', fontWeight: 600, fontFamily: 'Outfit, sans-serif' },
        text: `Avg: ${avg}`,
      },
    });

    // 4. Min Annotation (Green)
    annotations.push({
      y: min,
      borderColor: '#10b981', // Emerald-500
      borderWidth: 2,
      strokeDashArray: 2,
      label: {
        borderColor: '#10b981',
        position: 'left',
        textAnchor: 'start',
        style: { color: '#fff', background: '#10b981', fontWeight: 600, fontFamily: 'Outfit, sans-serif' },
        text: `Min: ${min}`,
      },
    });
  }
  
  return annotations;
});

// Dynamic options for ApexCharts
const chartOptions = computed(() => {
  const isDark = props.isDarkTheme;
  const chartTheme = (isDark ? 'dark' : 'light') as 'dark' | 'light';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
  const labelColor = isDark ? '#94a3b8' : '#475569';
  const accentColors = ['#0052cc'];

  return {
    chart: {
      id: 'trend-chart',
      type: 'line' as const,
      toolbar: { show: false },
      background: 'transparent',
      animations: {
        enabled: true,
        easing: 'linear',
        dynamicAnimation: { speed: 500 },
      },
    },
    theme: {
      mode: chartTheme,
    },
    colors: accentColors,
    stroke: {
      curve: 'smooth' as const,
      width: 3,
    },
    grid: {
      borderColor: gridColor,
      strokeDashArray: 3,
      padding: { left: 10, right: 10 },
    },
    xaxis: {
      categories: categories.value,
      labels: {
        style: { colors: labelColor, fontFamily: 'Outfit, sans-serif', fontSize: '10px' },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: labelColor, fontFamily: 'Outfit, sans-serif' },
        formatter: (val: number) => `${val.toFixed(1)} ${yUnit.value}`,
      },
    },
    annotations: {
      yaxis: yAnnotations.value,
    },
    tooltip: {
      theme: chartTheme,
      x: { show: true },
      y: {
        formatter: (val: number) => `${val} ${yUnit.value}`,
      },
    },
    legend: {
      position: 'top' as const,
      horizontalAlign: 'right' as const,
      fontFamily: 'Outfit, sans-serif',
      labels: { colors: labelColor },
    },
  };
});
</script>

<template>
  <div class="trend-chart-card glass-panel">
    <div class="card-header">
      <div class="title-group">
        <span class="chart-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
        </span>
        <h3>Grafik Tren Historis</h3>
      </div>
      <!-- Date Range Controls -->
      <div class="range-controls">
        <select v-model="timeRange" class="range-select">
          <option value="last_hour">Last Hour</option>
          <option value="last_day">Last Day</option>
          <option value="last_week">Last Week</option>
          <option value="last_month">Last Month</option>
          <option value="custom">Custom Range...</option>
        </select>
        
        <div v-if="timeRange === 'custom'" class="custom-range-inputs">
          <input type="datetime-local" v-model="customStart" class="range-date" />
          <span style="color: var(--text-secondary)">-</span>
          <input type="datetime-local" v-model="customEnd" class="range-date" />
          <button @click="applyDateRange" class="btn-apply">Apply</button>
        </div>
        
        <button @click="exportToCSV" class="btn-export" title="Export Data to CSV" :disabled="logs.length === 0">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          CSV
        </button>
      </div>
      
      <!-- Parameter Tabs -->
      <div class="tabs-container">
        <button @click="activeTab = 'velZ'" class="tab-btn" :class="{ active: activeTab === 'velZ' }">Vel Z</button>
        <button @click="activeTab = 'velX'" class="tab-btn" :class="{ active: activeTab === 'velX' }">Vel X</button>
        <button @click="activeTab = 'accZ'" class="tab-btn" :class="{ active: activeTab === 'accZ' }">Acc Z</button>
        <button @click="activeTab = 'accX'" class="tab-btn" :class="{ active: activeTab === 'accX' }">Acc X</button>
        <button @click="activeTab = 'temp'" class="tab-btn" :class="{ active: activeTab === 'temp' }">Temp</button>
      </div>
    </div>
    
    <div class="chart-body">
      <div v-if="logs.length === 0" class="empty-chart">
        <span class="icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        </span>
        <p>Menunggu data log historis...</p>
      </div>
      <div v-else class="chart-wrapper">
        <apexchart 
          height="100%" 
          width="100%" 
          :options="chartOptions" 
          :series="series"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.trend-chart-card {
  padding: 24px;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 16px;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.chart-icon {
  font-size: 1.2rem;
}

h3 {
  font-size: 1.1rem;
  font-weight: 700;
}

.tabs-container {
  display: flex;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  padding: 4px;
  border-radius: 8px;
}

.tab-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  padding: 6px 14px;
  font-family: 'Outfit', sans-serif;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn.active {
  background: var(--bg-panel-solid);
  color: var(--accent-primary);
  box-shadow: 0 4px 10px -4px rgba(0, 0, 0, 0.2);
}

.chart-body {
  flex-grow: 1;
  min-height: 250px;
  position: relative;
}

.chart-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.empty-chart {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 10px;
  color: var(--text-muted);
}

.empty-chart .icon {
  font-size: 2rem;
}

.range-controls {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.range-select {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 6px 16px;
  border-radius: 20px;
  font-family: 'Poppins', sans-serif;
  font-size: 0.8rem;
  font-weight: 600;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;
}

.range-select:hover {
  background: var(--bg-input-hover);
  border-color: var(--border-hover);
}

.custom-range-inputs {
  display: flex;
  gap: 8px;
  align-items: center;
}

.range-date {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 5px 12px;
  border-radius: 20px;
  font-family: 'Poppins', sans-serif;
  font-size: 0.78rem;
  outline: none;
  transition: border-color 0.2s;
}

.range-date:focus {
  border-color: var(--accent-primary);
}

.btn-apply {
  background: var(--accent-primary);
  color: white;
  border: none;
  padding: 6px 16px;
  border-radius: 20px;
  font-family: 'Poppins', sans-serif;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.15s;
}

.btn-apply:hover {
  background: var(--accent-hover);
}

.btn-apply:active {
  transform: scale(0.97);
}

.btn-export {
  background: var(--bg-panel-solid);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  padding: 6px 16px;
  border-radius: 20px;
  font-family: 'Poppins', sans-serif;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
}

.btn-export:hover:not(:disabled) {
  background: var(--accent-light);
  color: var(--accent-primary);
  border-color: var(--accent-primary);
}

.btn-export:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
