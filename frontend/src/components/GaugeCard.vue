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
  const thresholdCritical = props.setpoint;
  const thresholdWarning = props.setpoint * 1.25;
  if (props.value < thresholdCritical) return 'critical';
  if (props.value < thresholdWarning) return 'warning';
  return 'safe';
});

const statusClass = computed(() => `status-${status.value}`);

const progressPercent = computed(() => {
  if (props.value === null || props.value === undefined || !props.setpoint) return 0;
  return Math.min(Math.round((props.value / props.setpoint) * 100), 100);
});

// Semicircle circumference for R=40 is pi * R = 125.66
const strokeDashArray = 125.66;
const strokeDashOffset = computed(() => {
  const percent = progressPercent.value;
  return strokeDashArray - (percent / 100) * strokeDashArray;
});

const displayValue = computed(() => {
  if (props.value === null || props.value === undefined) return '--';
  return props.value.toFixed(2);
});

const displaySetpoint = computed(() => {
  if (props.setpoint === null || props.setpoint === undefined) return '--';
  return props.setpoint.toFixed(1);
});

const strokeColor = computed(() => {
  if (status.value === 'critical') return 'var(--status-critical, #ef4444)';
  if (status.value === 'warning') return 'var(--status-warning, #f59e0b)';
  return 'var(--accent-cyan, #00d2ff)';
});
</script>

<template>
  <div class="gauge-card glass-panel" :class="statusClass">
    <div class="metric-header">
      <div class="title-group">
        <span class="icon" v-html="icon"></span>
        <h4>{{ title }}</h4>
      </div>
      <span class="pulse-dot"></span>
    </div>
    
    <div class="metric-body">
      <div class="gauge-wrapper">
        <svg viewBox="0 0 100 55" class="gauge-svg">
          <!-- Background track -->
          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8" stroke-linecap="round" />
          <!-- Animated Fill -->
          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" :stroke="strokeColor" stroke-width="8" stroke-linecap="round" 
                :stroke-dasharray="strokeDashArray" :stroke-dashoffset="strokeDashOffset" style="transition: stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s;" />
        </svg>
        <div class="gauge-overlay">
          <span class="value text-mono">{{ displayValue }}</span>
          <span class="unit">{{ unit }}</span>
        </div>
      </div>
      
      <div class="gauge-labels">
        <span class="percent text-mono">{{ progressPercent }}%</span>
        <span class="limit">Limit: {{ displaySetpoint }} {{ unit }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gauge-card {
  padding: 12px 16px;
  position: relative;
  overflow: hidden;
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
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
}

.gauge-wrapper {
  position: relative;
  width: 100%;
  max-width: 180px;
  margin: 0 auto;
}

.gauge-svg {
  width: 100%;
  height: auto;
  display: block;
}

.gauge-overlay {
  position: absolute;
  bottom: 0px;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
}

.value {
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1;
}

.unit {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-top: 2px;
}

.gauge-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
  margin-top: 10px;
}

/* Status colors and glows */
.status-safe .pulse-dot {
  background-color: var(--status-safe);
  box-shadow: 0 0 10px var(--status-safe);
}
.status-safe:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px -2px rgba(16, 185, 129, 0.15);
}

.status-warning .pulse-dot {
  background-color: var(--status-warning);
  box-shadow: 0 0 10px var(--status-warning);
  animation: pulse-soft 1.5s infinite;
}
.status-warning .value {
  color: var(--status-warning);
}
.status-warning:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px -2px rgba(245, 158, 11, 0.15);
}

.status-critical .pulse-dot {
  background-color: var(--status-critical);
  box-shadow: 0 0 12px var(--status-critical);
  animation: pulse-soft 0.8s infinite;
}
.status-critical .value {
  color: var(--status-critical);
  animation: shake-mild 0.5s infinite;
}
.status-critical:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px -2px rgba(239, 68, 68, 0.15);
}
</style>
