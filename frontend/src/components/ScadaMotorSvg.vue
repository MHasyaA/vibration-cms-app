<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  sensorName: string;
  velocityZ: number | null | undefined;
  velocityX: number | null | undefined;
  temperature: number | null | undefined;
  setpointZ: number | null | undefined;
  setpointX: number | null | undefined;
  setpointTemp: number | null | undefined;
}>();

const maxVelocity = computed(() => {
  const z = props.velocityZ || 0;
  const x = props.velocityX || 0;
  return Math.max(z, x);
});

const status = computed(() => {
  const limitZ = props.setpointZ || 7.1;
  const limitX = props.setpointX || 7.1;
  const zVal = props.velocityZ || 0;
  const xVal = props.velocityX || 0;
  
  if (zVal >= limitZ || xVal >= limitX) return 'critical';
  if (zVal >= limitZ * 0.7 || xVal >= limitX * 0.7) return 'warning';
  return 'safe';
});

const tempStatus = computed(() => {
  const val = props.temperature || 0;
  const limit = props.setpointTemp || 70;
  if (val >= limit) return 'critical';
  if (val >= limit * 0.8) return 'warning';
  return 'safe';
});

const shakeClass = computed(() => {
  if (status.value === 'critical') return 'shake-heavy';
  if (status.value === 'warning') return 'shake-medium';
  return '';
});

const statusColor = computed(() => {
  if (status.value === 'critical') return 'var(--status-critical)';
  if (status.value === 'warning') return 'var(--status-warning)';
  return 'var(--status-safe)';
});

const tempColor = computed(() => {
  if (tempStatus.value === 'critical') return 'var(--status-critical)';
  if (tempStatus.value === 'warning') return 'var(--status-warning)';
  return 'var(--status-safe)';
});
</script>

<template>
  <div class="scada-svg-container glass-panel">
    <div class="scada-meta">
      <span class="scada-tag">MODEL SCADA INTERAKTIF</span>
      <h3 class="scada-title">{{ sensorName }}</h3>
    </div>
    
    <div class="canvas-area">
      <!-- Interactive Motor GIF Wrapper -->
      <div class="motor-wrapper" :class="shakeClass">
        <!-- Ambient Glow from under the motor based on severity status -->
        <div class="glow-bg" :style="{ background: `radial-gradient(ellipse at center, ${statusColor} 0%, transparent 60%)`, opacity: 0.25 }"></div>
        
        <!-- Smoke effect overlay — only visible when temperature is critical -->
        <div v-if="tempStatus === 'critical' || tempStatus === 'warning'" class="smoke-container" :class="'smoke-' + tempStatus">
          <div class="smoke-puff puff-1"></div>
          <div class="smoke-puff puff-2"></div>
          <div class="smoke-puff puff-3"></div>
          <div class="smoke-puff puff-4"></div>
          <div class="smoke-puff puff-5"></div>
        </div>

        <img src="../assets/motor_3p.gif" class="motor-img" alt="Motor 3 Phase" />
      </div>
    </div>

    <!-- Live SCADA telemetry block below diagram -->
    <div class="scada-telemetry">
      <div class="tel-item">
        <span class="lbl">Max Vibration:</span>
        <span class="val text-mono" :style="{ color: statusColor }">
          {{ maxVelocity === 0 ? '--' : maxVelocity.toFixed(2) }} mm/s
        </span>
      </div>
      <div class="tel-item">
        <span class="lbl">Stator Temp:</span>
        <span class="val text-mono" :style="{ color: tempColor }">
          {{ temperature === null || temperature === undefined ? '--' : temperature.toFixed(1) }} °C
        </span>
      </div>
      <div class="tel-item">
        <span class="lbl">System Health:</span>
        <span class="status-badge-text" :class="'health-' + status">
          {{ status.toUpperCase() }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scada-svg-container {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.scada-meta {
  margin-bottom: 12px;
}

.scada-tag {
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 1.5px;
  color: var(--accent-cyan);
  background: rgba(6, 182, 212, 0.08);
  border: 1px solid rgba(6, 182, 212, 0.15);
  padding: 3px 8px;
  border-radius: 4px;
  display: inline-block;
  margin-bottom: 6px;
}

.scada-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.canvas-area {
  flex-grow: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  min-height: 180px;
}

.motor-wrapper {
  position: relative;
  width: 100%;
  max-width: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.motor-img {
  width: 100%;
  height: auto;
  position: relative;
  z-index: 1;
}

.glow-bg {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 150%;
  height: 150%;
  pointer-events: none;
  z-index: 0;
  transition: background 0.3s ease;
}

/* ========================
   SMOKE EFFECT
======================== */
.smoke-container {
  position: absolute;
  bottom: 55%;
  left: 50%;
  transform: translateX(-50%);
  width: 200px;
  height: 120px;
  pointer-events: none;
  z-index: 2;
}

.smoke-puff {
  position: absolute;
  bottom: 0;
  border-radius: 50%;
  animation: rise-and-fade 3s ease-in infinite;
  opacity: 0;
}

/* Smoke color and intensity by status (darker charcoal industrial smoke) */
.smoke-critical .smoke-puff {
  background: radial-gradient(circle, rgba(40, 40, 40, 0.92) 0%, rgba(20, 20, 20, 0) 70%);
}
.smoke-warning .smoke-puff {
  background: radial-gradient(circle, rgba(90, 90, 90, 0.7) 0%, rgba(40, 40, 40, 0) 70%);
}

/* Each puff: different size, position, delay */
.puff-1 {
  width: 50px; height: 50px;
  left: 30%;
  animation-delay: 0s;
  animation-duration: 3.2s;
}
.puff-2 {
  width: 65px; height: 65px;
  left: 50%;
  animation-delay: 0.6s;
  animation-duration: 2.8s;
}
.puff-3 {
  width: 42px; height: 42px;
  left: 20%;
  animation-delay: 1.2s;
  animation-duration: 3.5s;
}
.puff-4 {
  width: 55px; height: 55px;
  left: 60%;
  animation-delay: 1.8s;
  animation-duration: 2.6s;
}
.puff-5 {
  width: 48px; height: 48px;
  left: 40%;
  animation-delay: 0.9s;
  animation-duration: 3.8s;
}

@keyframes rise-and-fade {
  0%   { transform: translateY(0)     scale(0.4); opacity: 0; }
  15%  { opacity: 0.8; }
  50%  { transform: translateY(-60px) scale(1.3); opacity: 0.5; }
  80%  { transform: translateY(-100px) scale(1.8); opacity: 0.15; }
  100% { transform: translateY(-130px) scale(2.2); opacity: 0; }
}

/* Shaking animations based on vibration level */
.shake-heavy {
  animation: shake-extreme 0.15s infinite;
}

.shake-medium {
  animation: shake-mild 0.25s infinite;
}

@keyframes shake-extreme {
  0% { transform: translate(0, 0) rotate(0deg); }
  25% { transform: translate(3px, 3px) rotate(1deg); }
  50% { transform: translate(0, 0) rotate(0deg); }
  75% { transform: translate(-3px, 3px) rotate(-1deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}

@keyframes shake-mild {
  0% { transform: translate(0, 0) rotate(0deg); }
  25% { transform: translate(1px, 1px) rotate(0.5deg); }
  50% { transform: translate(0, 0) rotate(0deg); }
  75% { transform: translate(-1px, 1px) rotate(-0.5deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}

/* --- TELEMETRY BOTTOM BLOCK --- */
.scada-telemetry {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}
.tel-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--bg-input);
  padding: 8px;
  border-radius: 8px;
}
.tel-item .lbl {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-bottom: 4px;
  font-weight: 600;
}
.tel-item .val {
  font-size: 1.1rem;
  font-weight: 700;
}
.status-badge-text {
  font-size: 0.85rem;
  font-weight: 800;
  padding: 4px 12px;
  border-radius: 4px;
}
.health-safe {
  color: var(--status-safe);
  background: var(--status-safe-glow);
}
.health-warning {
  color: var(--status-warning);
  background: var(--status-warning-glow);
  animation: pulse-soft 1s infinite;
}
.health-critical {
  color: var(--status-critical);
  background: var(--status-critical-glow);
}
</style>
