<script setup lang="ts">
import { ref, computed } from 'vue';
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

const activeTab = ref<'velocity' | 'acceleration' | 'temperature'>('velocity');

const sortedLogs = computed(() => {
  // Sort logs by timestamp ascending for chart drawing
  return [...props.logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
});

// Timestamps mapped to readable locale strings
const categories = computed(() => {
  return sortedLogs.value.map((log) => {
    const d = new Date(log.timestamp);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });
});

// Series definitions depending on active tab
const series = computed(() => {
  if (activeTab.value === 'velocity') {
    return [
      {
        name: 'Z-Axis Velocity',
        data: sortedLogs.value.map((l) => Number(l.zVelocity.toFixed(2))),
      },
      {
        name: 'X-Axis Velocity',
        data: sortedLogs.value.map((l) => Number(l.xVelocity.toFixed(2))),
      },
    ];
  } else if (activeTab.value === 'acceleration') {
    return [
      {
        name: 'Z-Axis Acceleration',
        data: sortedLogs.value.map((l) => Number(l.zAcceleration.toFixed(2))),
      },
      {
        name: 'X-Axis Acceleration',
        data: sortedLogs.value.map((l) => Number(l.xAcceleration.toFixed(2))),
      },
    ];
  } else {
    return [
      {
        name: 'Core Temperature',
        data: sortedLogs.value.map((l) => Number(l.temperature.toFixed(1))),
      },
    ];
  }
});

// Chart Y-Axis unit and label
const yUnit = computed(() => {
  if (activeTab.value === 'velocity') return 'mm/s';
  if (activeTab.value === 'acceleration') return 'mm/s²';
  return '°C';
});

// Dynamic limit annotations based on setpoints
const yAnnotations = computed(() => {
  const annotations: any[] = [];
  
  if (activeTab.value === 'velocity') {
    const limitZ = props.setpointZVel || 7.1;
    annotations.push({
      y: limitZ,
      borderColor: '#ef4444',
      borderWidth: 2,
      strokeDashArray: 4,
      label: {
        borderColor: '#ef4444',
        style: { color: '#fff', background: '#ef4444', fontWeight: 600 },
        text: `Z-Vel Limit: ${limitZ} mm/s`,
      },
    });
  } else if (activeTab.value === 'acceleration') {
    const limitZAcc = props.setpointZAcc || 10.0;
    annotations.push({
      y: limitZAcc,
      borderColor: '#ef4444',
      borderWidth: 2,
      strokeDashArray: 4,
      label: {
        borderColor: '#ef4444',
        style: { color: '#fff', background: '#ef4444', fontWeight: 600 },
        text: `Z-Acc Limit: ${limitZAcc} mm/s²`,
      },
    });
  } else {
    const limitTemp = props.setpointTemp || 70;
    annotations.push({
      y: limitTemp,
      borderColor: '#ef4444',
      borderWidth: 2,
      strokeDashArray: 4,
      label: {
        borderColor: '#ef4444',
        style: { color: '#fff', background: '#ef4444', fontWeight: 600 },
        text: `Temp Limit: ${limitTemp} °C`,
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
  const accentColors = activeTab.value === 'temperature' 
    ? ['#f59e0b'] // Orange/Yellow for Temperature
    : ['#6366f1', '#06b6d4']; // Purple & Cyan for Z/X axis

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
      
      <!-- Parameter Tabs -->
      <div class="tabs-container">
        <button 
          @click="activeTab = 'velocity'" 
          class="tab-btn" 
          :class="{ active: activeTab === 'velocity' }"
        >
          Velocity (Getaran)
        </button>
        <button 
          @click="activeTab = 'acceleration'" 
          class="tab-btn" 
          :class="{ active: activeTab === 'acceleration' }"
        >
          Acceleration (Gaya)
        </button>
        <button 
          @click="activeTab = 'temperature'" 
          class="tab-btn" 
          :class="{ active: activeTab === 'temperature' }"
        >
          Temperature (Suhu)
        </button>
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
</style>
