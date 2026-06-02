<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  title: string;
  value: number | null | undefined;
  unit: string;
  setpoint: number | null | undefined;
  icon: string;
}>();

const status = computed(() => {
  if (props.value === null || props.value === undefined || !props.setpoint) return 'safe';
  
  // Custom heuristics for warnings vs criticals based on setpoint
  const thresholdWarning = props.setpoint * 0.7; // Warning is at 70% of setpoint/limit
  const thresholdCritical = props.setpoint;
  
  if (props.value >= thresholdCritical) return 'critical';
  if (props.value >= thresholdWarning) return 'warning';
  return 'safe';
});

const statusClass = computed(() => {
  return `status-${status.value}`;
});

const progressPercent = computed(() => {
  if (props.value === null || props.value === undefined || !props.setpoint) return 0;
  return Math.min(Math.round((props.value / props.setpoint) * 100), 100);
});

const displayValue = computed(() => {
  if (props.value === null || props.value === undefined) return '--';
  return props.value.toFixed(2);
});

const displaySetpoint = computed(() => {
  if (props.setpoint === null || props.setpoint === undefined) return '--';
  return props.setpoint.toFixed(1);
});
</script>

<template>
  <div class="metric-card glass-panel" :class="statusClass">
    <div class="metric-header">
      <div class="title-group">
        <span class="icon" v-html="icon"></span>
        <h4>{{ title }}</h4>
      </div>
      <span class="pulse-dot"></span>
    </div>
    
    <div class="metric-body">
      <div class="value-wrapper">
        <span class="value text-mono">{{ displayValue }}</span>
        <span class="unit">{{ unit }}</span>
      </div>
      
      <!-- Progress Bar representation -->
      <div class="progress-container">
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <div class="progress-labels">
          <span class="percent text-mono">{{ progressPercent }}%</span>
          <span class="limit">Limit: {{ displaySetpoint }} {{ unit }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.metric-card {
  padding: 12px 16px;
  position: relative;
  overflow: hidden;
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), border-color 0.25s ease;
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon {
  font-size: 1.2rem;
}

h4 {
  font-size: 0.8rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.value-wrapper {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 10px;
}

.value {
  font-size: 1.8rem;
  font-weight: 800;
  line-height: 1;
}

.unit {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.progress-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-track {
  width: 100%;
  height: 6px;
  background: rgba(148, 163, 184, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease-out;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
}

/* Status variants */
.status-safe .pulse-dot {
  background-color: var(--status-safe);
  box-shadow: 0 0 10px var(--status-safe);
}
.status-safe .progress-fill {
  background: var(--status-safe);
  box-shadow: 0 0 8px var(--status-safe-glow);
}
.status-safe:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px -2px rgba(16, 185, 129, 0.15), 0 0 1px rgba(16, 185, 129, 0.25);
}

.status-warning .pulse-dot {
  background-color: var(--status-warning);
  box-shadow: 0 0 10px var(--status-warning);
  animation: pulse-soft 1.5s infinite;
}
.status-warning .progress-fill {
  background: var(--status-warning);
  box-shadow: 0 0 8px var(--status-warning-glow);
}
.status-warning .value {
  color: var(--status-warning);
}
.status-warning:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px -2px rgba(245, 158, 11, 0.15), 0 0 1px rgba(245, 158, 11, 0.25);
}

.status-critical .pulse-dot {
  background-color: var(--status-critical);
  box-shadow: 0 0 12px var(--status-critical);
  animation: pulse-soft 0.8s infinite;
}
.status-critical .progress-fill {
  background: var(--status-critical);
  box-shadow: 0 0 8px var(--status-critical-glow);
}
.status-critical .value {
  color: var(--status-critical);
  animation: shake-mild 0.5s infinite;
}
.status-critical:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px -2px rgba(239, 68, 68, 0.15), 0 0 1px rgba(239, 68, 68, 0.25);
}
</style>
