<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import apexchart from 'vue3-apexcharts';

const props = defineProps<{
  logs: Array<{
    timestamp: string;
    temperature: number;
    zVelocity: number;
    xVelocity: number;
    zAcceleration: number;
    xAcceleration: number;
    pressure?: number;
    flow?: number;
    level?: number;
  }>;
  setpointTemp: number | null | undefined;
  setpointZVel: number | null | undefined;
  setpointXVel: number | null | undefined;
  setpointZAcc: number | null | undefined;
  setpointXAcc: number | null | undefined;
  setpointPressure?: number | null | undefined;
  setpointFlow?: number | null | undefined;
  setpointLevel?: number | null | undefined;
  isDarkTheme: boolean;
  activeTab?: TabType;
}>();

const emit = defineEmits<{
  (e: 'range-change', payload: { start?: string; end?: string }): void;
  (e: 'update:activeTab', tab: TabType): void;
}>();

type TabType = 'velZ' | 'velX' | 'accZ' | 'accX' | 'temp' | 'pressure' | 'flow' | 'level' | 'correlation';
const activeTab = ref<TabType>(props.activeTab || 'velZ');

watch(() => props.activeTab, (newVal) => {
  if (newVal && newVal !== activeTab.value) {
    activeTab.value = newVal;
  }
});

watch(activeTab, (newVal) => {
  emit('update:activeTab', newVal);
});

const timeRange = ref<'last_hour' | 'last_day' | 'last_week' | 'last_month' | 'custom'>('last_hour');
const customStart = ref('');
const customEnd = ref('');

// Checked parameters in Correlation mode
const selectedParams = ref<string[]>(['velZ', 'temp', 'pressure']);

const checkboxOptions = [
  { val: 'velZ', label: 'Velocity Z (mm/s)', unit: 'mm/s', color: '#6366f1' },
  { val: 'velX', label: 'Velocity X (mm/s)', unit: 'mm/s', color: '#a855f7' },
  { val: 'accZ', label: 'Accel Z (mm/s²)', unit: 'mm/s²', color: '#ec4899' },
  { val: 'accX', label: 'Accel X (mm/s²)', unit: 'mm/s²', color: '#f43f5e' },
  { val: 'temp', label: 'Temperature (°C)', unit: '°C', color: '#eab308' },
  { val: 'pressure', label: 'Pressure (Bar)', unit: 'Bar', color: '#00d2ff' },
  { val: 'flow', label: 'Flow (L/min)', unit: 'L/min', color: '#10b981' },
  { val: 'level', label: 'Level (mm)', unit: 'mm', color: '#3b82f6' },
];

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
  
  const headers = [
    'Timestamp', 
    'Core Temperature (°C)', 
    'Z-Axis Velocity (mm/s)', 
    'X-Axis Velocity (mm/s)', 
    'Z-Axis Acceleration (mm/s²)', 
    'X-Axis Acceleration (mm/s²)',
    'Pressure (Bar)',
    'Flow Rate (L/min)',
    'Liquid Level (mm)'
  ];
  
  const rows = sortedLogs.value.map(log => {
    const formattedDate = new Date(log.timestamp).toLocaleString('id-ID').replace(',', '');
    return [
      `"${formattedDate}"`,
      log.temperature.toFixed(2),
      log.zVelocity.toFixed(2),
      log.xVelocity.toFixed(2),
      log.zAcceleration.toFixed(2),
      log.xAcceleration.toFixed(2),
      (log.pressure ?? 0).toFixed(2),
      (log.flow ?? 0).toFixed(2),
      (log.level ?? 0).toFixed(0)
    ].join(',');
  });
  
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
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

const series = computed(() => {
  if (activeTab.value !== 'correlation') {
    let name = '';
    let data: number[] = [];
    switch(activeTab.value) {
      case 'velZ': name = 'Velocity Z'; data = sortedLogs.value.map(l => Number(l.zVelocity?.toFixed(2) ?? 0)); break;
      case 'velX': name = 'Velocity X'; data = sortedLogs.value.map(l => Number(l.xVelocity?.toFixed(2) ?? 0)); break;
      case 'accZ': name = 'Accel Z'; data = sortedLogs.value.map(l => Number(l.zAcceleration?.toFixed(2) ?? 0)); break;
      case 'accX': name = 'Accel X'; data = sortedLogs.value.map(l => Number(l.xAcceleration?.toFixed(2) ?? 0)); break;
      case 'temp': name = 'Temperature'; data = sortedLogs.value.map(l => Number(l.temperature?.toFixed(1) ?? 0)); break;
      case 'pressure': name = 'Pressure'; data = sortedLogs.value.map(l => Number((l.pressure ?? 0).toFixed(2))); break;
      case 'flow': name = 'Flow Rate'; data = sortedLogs.value.map(l => Number((l.flow ?? 0).toFixed(2))); break;
      case 'level': name = 'Liquid Level'; data = sortedLogs.value.map(l => Number((l.level ?? 0).toFixed(0))); break;
    }
    return [{ name, data }];
  } else {
    // Correlation Mode: Return multiple checked parameters
    return checkboxOptions
      .filter(opt => selectedParams.value.includes(opt.val))
      .map(opt => {
        let data: number[] = [];
        switch(opt.val) {
          case 'velZ': data = sortedLogs.value.map(l => Number(l.zVelocity?.toFixed(2) ?? 0)); break;
          case 'velX': data = sortedLogs.value.map(l => Number(l.xVelocity?.toFixed(2) ?? 0)); break;
          case 'accZ': data = sortedLogs.value.map(l => Number(l.zAcceleration?.toFixed(2) ?? 0)); break;
          case 'accX': data = sortedLogs.value.map(l => Number(l.xAcceleration?.toFixed(2) ?? 0)); break;
          case 'temp': data = sortedLogs.value.map(l => Number(l.temperature?.toFixed(1) ?? 0)); break;
          case 'pressure': data = sortedLogs.value.map(l => Number((l.pressure ?? 0).toFixed(2))); break;
          case 'flow': data = sortedLogs.value.map(l => Number((l.flow ?? 0).toFixed(2))); break;
          case 'level': data = sortedLogs.value.map(l => Number((l.level ?? 0).toFixed(0))); break;
        }
        return { name: opt.label, data };
      });
  }
});

const yUnit = computed(() => {
  if (activeTab.value.startsWith('vel')) return 'mm/s';
  if (activeTab.value.startsWith('acc')) return 'mm/s²';
  if (activeTab.value === 'temp') return '°C';
  if (activeTab.value === 'pressure') return 'Bar';
  if (activeTab.value === 'flow') return 'L/min';
  if (activeTab.value === 'level') return 'mm';
  return '';
});

const seriesDataForSingle = computed(() => {
  return sortedLogs.value.map(l => {
    switch(activeTab.value) {
      case 'velZ': return Number(l.zVelocity.toFixed(2));
      case 'velX': return Number(l.xVelocity.toFixed(2));
      case 'accZ': return Number(l.zAcceleration.toFixed(2));
      case 'accX': return Number(l.xAcceleration.toFixed(2));
      case 'temp': return Number(l.temperature.toFixed(1));
      case 'pressure': return Number((l.pressure ?? 0).toFixed(2));
      case 'flow': return Number((l.flow ?? 0).toFixed(2));
      case 'level': return Number((l.level ?? 0).toFixed(0));
      default: return 0;
    }
  });
});

const stats = computed(() => {
  if (activeTab.value === 'correlation') return null;
  const data = seriesDataForSingle.value;
  if (data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const avg = data.reduce((a, b) => a + b, 0) / data.length;
  return { min, max, avg: Number(avg.toFixed(2)) };
});

// Dynamic limit annotations based on setpoints
const yAnnotations = computed(() => {
  const annotations: any[] = [];
  if (activeTab.value === 'correlation') return annotations;
  
  let limitValue = 0;
  let limitLabel = '';

  switch(activeTab.value) {
    case 'velZ': limitValue = props.setpointZVel || 7.1; limitLabel = 'Z-Vel Limit'; break;
    case 'velX': limitValue = props.setpointXVel || 7.1; limitLabel = 'X-Vel Limit'; break;
    case 'accZ': limitValue = props.setpointZAcc || 10.0; limitLabel = 'Z-Acc Limit'; break;
    case 'accX': limitValue = props.setpointXAcc || 10.0; limitLabel = 'X-Acc Limit'; break;
    case 'temp': limitValue = props.setpointTemp || 70.0; limitLabel = 'Temp Limit'; break;
    case 'pressure': limitValue = props.setpointPressure || 5.0; limitLabel = 'Press Limit'; break;
    case 'flow': limitValue = props.setpointFlow || 50.0; limitLabel = 'Flow Limit'; break;
    case 'level': limitValue = props.setpointLevel || 800.0; limitLabel = 'Level Limit'; break;
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
      borderColor: '#f97316',
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
      borderColor: '#0ea5e9',
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
      borderColor: '#10b981',
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

const chartYAxis = computed(() => {
  const isDark = props.isDarkTheme;
  const labelColor = isDark ? '#94a3b8' : '#475569';

  if (activeTab.value !== 'correlation') {
    return {
      labels: {
        style: { colors: labelColor, fontFamily: 'Outfit, sans-serif' },
        formatter: (val: number) => `${val.toFixed(1)} ${yUnit.value}`,
      },
    };
  } else {
    const activeOpts = checkboxOptions.filter(opt => selectedParams.value.includes(opt.val));
    if (activeOpts.length === 0) return { show: false };

    // Align each series to its own scale, showing axis for first 2 unique units
    const seenUnits: string[] = [];
    return activeOpts.map((opt) => {
      let show = false;
      let opposite = false;
      
      if (!seenUnits.includes(opt.unit)) {
        seenUnits.push(opt.unit);
        show = true;
        if (seenUnits.length === 2) {
          opposite = true;
        } else if (seenUnits.length > 2) {
          show = false; // Hide additional axis lines to prevent clutter, but keep independent scaling
        }
      }

      return {
        seriesName: opt.label,
        show: show,
        opposite: opposite,
        title: {
          text: show ? opt.unit : undefined,
          style: { color: opt.color, fontFamily: 'Outfit, sans-serif', fontWeight: 600 },
        },
        labels: {
          style: { colors: opt.color, fontFamily: 'Outfit, sans-serif' },
          formatter: (val: number) => `${val.toFixed(1)}`,
        },
        axisBorder: {
          show: show,
          color: opt.color,
        },
        axisTicks: {
          show: show,
          color: opt.color,
        },
      };
    });
  }
});

const chartColors = computed(() => {
  if (activeTab.value !== 'correlation') {
    return ['#00d2ff'];
  } else {
    return checkboxOptions
      .filter(opt => selectedParams.value.includes(opt.val))
      .map(opt => opt.color);
  }
});

// Dynamic options for ApexCharts
const chartOptions = computed(() => {
  const isDark = props.isDarkTheme;
  const chartTheme = (isDark ? 'dark' : 'light') as 'dark' | 'light';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
  const labelColor = isDark ? '#94a3b8' : '#475569';

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
    colors: chartColors.value,
    stroke: {
      curve: 'smooth' as const,
      width: activeTab.value === 'correlation' ? 2 : 3,
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
    yaxis: chartYAxis.value,
    annotations: {
      yaxis: yAnnotations.value,
    },
    tooltip: {
      theme: chartTheme,
      x: { show: true },
      y: {
        formatter: (val: number, { seriesIndex }: any) => {
          if (activeTab.value !== 'correlation') {
            return `${val} ${yUnit.value}`;
          }
          const activeOpts = checkboxOptions.filter(opt => selectedParams.value.includes(opt.val));
          const unit = activeOpts[seriesIndex]?.unit || '';
          return `${val} ${unit}`;
        },
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

onMounted(() => {
  applyDateRange();
});
</script>

<template>
  <div class="trend-chart-card glass-panel flex-col" style="height: 100%; gap: 16px;">
    <div class="card-header">
      <div class="title-group">
        <span class="chart-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
        </span>
        <h3>Grafik Tren Historis CMS</h3>
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
      <div class="tabs-container" style="flex-wrap: wrap; gap: 4px;">
        <button @click="activeTab = 'velZ'" class="tab-btn" :class="{ active: activeTab === 'velZ' }">Vel Z</button>
        <button @click="activeTab = 'velX'" class="tab-btn" :class="{ active: activeTab === 'velX' }">Vel X</button>
        <button @click="activeTab = 'accZ'" class="tab-btn" :class="{ active: activeTab === 'accZ' }">Acc Z</button>
        <button @click="activeTab = 'accX'" class="tab-btn" :class="{ active: activeTab === 'accX' }">Acc X</button>
        <button @click="activeTab = 'temp'" class="tab-btn" :class="{ active: activeTab === 'temp' }">Temp</button>
        <button @click="activeTab = 'pressure'" class="tab-btn" :class="{ active: activeTab === 'pressure' }">Pressure</button>
        <button @click="activeTab = 'flow'" class="tab-btn" :class="{ active: activeTab === 'flow' }">Flow</button>
        <button @click="activeTab = 'level'" class="tab-btn" :class="{ active: activeTab === 'level' }">Level</button>
        <button @click="activeTab = 'correlation'" class="tab-btn tab-btn-special" :class="{ active: activeTab === 'correlation' }">🔗 Korelasi</button>
      </div>
    </div>

    <!-- Correlation Selector panel -->
    <div v-if="activeTab === 'correlation'" class="correlation-panel">
      <span class="panel-title">Pilih Parameter Korelasi:</span>
      <div class="checkbox-grid">
        <label v-for="opt in checkboxOptions" :key="opt.val" class="checkbox-label" :style="{ '--opt-color': opt.color }">
          <input type="checkbox" :value="opt.val" v-model="selectedParams" />
          <span class="custom-box"></span>
          {{ opt.label }}
        </label>
      </div>
    </div>
    
    <div class="chart-body flex-grow">
      <div v-if="logs.length === 0" class="empty-chart">
        <span class="icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        </span>
        <p>Menunggu data log historis...</p>
      </div>
      <div v-else-if="activeTab === 'correlation' && selectedParams.length === 0" class="empty-chart">
        <p>Silakan pilih minimal 1 parameter untuk menampilkan grafik korelasi.</p>
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
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 16px;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

h3 {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
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
  color: var(--accent-cyan);
  box-shadow: 0 4px 10px -4px rgba(0, 0, 0, 0.2);
}

.tab-btn-special.active {
  color: #ff5e36 !important;
  border-color: #ff5e36;
}

.correlation-panel {
  background: rgba(255, 255, 255, 0.02);
  border: 1px dashed var(--border-color);
  border-radius: 10px;
  padding: 12px 16px;
}

.panel-title {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.checkbox-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px 20px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  position: relative;
  user-select: none;
  transition: color 0.2s;
}

.checkbox-label input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0; width: 0;
}

.custom-box {
  height: 16px;
  width: 16px;
  background-color: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  display: inline-block;
  transition: all 0.2s;
}

.checkbox-label:hover .custom-box {
  border-color: var(--opt-color);
}

.checkbox-label input:checked ~ .custom-box {
  background-color: var(--opt-color);
  border-color: var(--opt-color);
  box-shadow: 0 0 8px var(--opt-color);
}

.checkbox-label input:checked ~ .custom-box::after {
  content: "";
  display: block;
  margin-left: 5px;
  margin-top: 1px;
  width: 4px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.checkbox-label input:checked {
  color: var(--text-primary);
}

.chart-body {
  flex-grow: 1;
  min-height: 280px;
  position: relative;
}

.chart-wrapper {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
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
  background: rgba(0, 210, 255, 0.1);
  color: var(--accent-cyan);
  border-color: var(--accent-cyan);
}

.btn-export:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
