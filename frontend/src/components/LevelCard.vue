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

const displayValue = computed(() => {
  if (props.value === null || props.value === undefined) return '--';
  return props.value.toFixed(0);
});

const displaySetpoint = computed(() => {
  if (props.setpoint === null || props.setpoint === undefined) return '--';
  return props.setpoint.toFixed(0);
});
</script>

<template>
  <div class="level-card glass-panel" :class="statusClass">
    <div class="card-inner">
      <!-- Header -->
      <div class="metric-header">
        <div class="title-group">
          <span class="icon" v-html="icon"></span>
          <h4>{{ title }}</h4>
        </div>
        <span class="pulse-dot"></span>
      </div>

      <!-- Symmetrical Center: Large Vertical Level Bar -->
      <div class="vertical-bar-wrapper">
        <div class="level-track">
          <div class="level-fill" :style="{ height: progressPercent + '%' }"></div>
        </div>
      </div>
      
      <!-- Footer: Readings -->
      <div class="level-footer">
        <div class="value-wrapper">
          <span class="value text-mono">{{ displayValue }}</span>
          <span class="unit">{{ unit }}</span>
        </div>
        <div class="labels">
          <span class="percent text-mono">{{ progressPercent }}% Full</span>
          <span class="limit">Limit: {{ displaySetpoint }} {{ unit }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.level-card {
  padding: 16px;
  position: relative;
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.card-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: space-between;
  gap: 16px;
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon {
  font-size: 1.1rem;
}

h4 {
  font-size: 0.78rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  margin: 0;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.vertical-bar-wrapper {
  width: 100%;
  display: flex;
  justify-content: center;
  flex-grow: 1;
  min-height: 140px;
}

.level-track {
  width: 32px;
  height: 100%;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  position: relative;
  overflow: hidden;
}

.level-fill {
  width: 100%;
  position: absolute;
  bottom: 0;
  left: 0;
  transition: height 0.5s ease-out;
  background: linear-gradient(to top, var(--accent-cyan) 0%, var(--accent-primary) 100%);
  box-shadow: 0 0 12px rgba(0, 210, 255, 0.4);
}

.level-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 100%;
}

.value-wrapper {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 4px;
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

.labels {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.72rem;
  color: var(--text-muted);
}

/* Status variants & colors */
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
.status-warning .level-fill {
  background: linear-gradient(to top, var(--status-warning) 0%, #f5b041 100%);
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.3);
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
.status-critical .level-fill {
  background: linear-gradient(to top, var(--status-critical) 0%, #ec7063 100%);
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
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
