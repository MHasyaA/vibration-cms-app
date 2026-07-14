<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  sensorName: string;
  level: number | null | undefined;
  setpointLevel: number | null | undefined;
  flow: number | null | undefined;
  pressure: number | null | undefined;
  temperature: number | null | undefined;
}>();

const limitLevel = computed(() => props.setpointLevel || 500.0);

const levelPercent = computed(() => {
  if (props.level === null || props.level === undefined || !limitLevel.value) return 0;
  // level is in mm, let's calculate percentage relative to the limit. 
  // Let's assume the limit represents 70% of the tank's total capacity for visual scaling.
  const maxCapacity = limitLevel.value * 1.43; // ~100% capacity
  return Math.min(Math.round((props.level / maxCapacity) * 100), 100);
});

const fillHeight = computed(() => {
  // SVG tank vertical height is 240px (from y=30 to y=270).
  // Let's scale the fill height between 5px and 225px based on levelPercent.
  return 5 + (levelPercent.value / 100) * 220;
});

const status = computed(() => {
  if (props.level === null || props.level === undefined || !limitLevel.value) return 'safe';
  // Lower level means critical (e.g. low coolant)
  const thresholdCritical = limitLevel.value;
  const thresholdWarning = limitLevel.value * 1.25;
  
  if (props.level < thresholdCritical) return 'critical';
  if (props.level < thresholdWarning) return 'warning';
  return 'safe';
});

const statusColor = computed(() => {
  if (status.value === 'critical') return 'var(--status-critical, #ef4444)';
  if (status.value === 'warning') return 'var(--status-warning, #f59e0b)';
  return 'var(--status-safe, #10b981)';
});

const statusBg = computed(() => {
  if (status.value === 'critical') return 'rgba(239, 68, 68, 0.15)';
  if (status.value === 'warning') return 'rgba(245, 158, 11, 0.15)';
  return 'rgba(16, 185, 129, 0.15)';
});
</script>

<template>
  <div class="scada-svg-container glass-panel">
    <!-- Header -->
    <div class="scada-meta">
      <span class="scada-tag">MODEL SCADA INTERAKTIF</span>
      <h3 class="scada-title">{{ sensorName }}</h3>
    </div>

    <!-- Canvas area containing the Water Tank SVG -->
    <div class="canvas-area">
      <!-- Glow backing reflecting the status color -->
      <div class="glow-bg" :style="{ background: `radial-gradient(ellipse at center, ${statusColor} 0%, transparent 60%)`, opacity: 0.15 }"></div>

      <svg class="tank-svg" viewBox="0 0 400 300" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- Water Liquid Gradient -->
          <linearGradient id="liquid-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#00bcd4" stop-opacity="0.85" />
            <stop offset="100%" stop-color="#0288d1" stop-opacity="0.5" />
          </linearGradient>
          
          <!-- Steel / Metal Gradient for Tank Body (Lighter Gray) -->
          <linearGradient id="metal-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#475569" />
            <stop offset="25%" stop-color="#64748b" />
            <stop offset="50%" stop-color="#94a3b8" />
            <stop offset="75%" stop-color="#64748b" />
            <stop offset="100%" stop-color="#475569" />
          </linearGradient>
        </defs>

        <!-- 1. The Tank Structure Background -->
        <!-- Main Tank Inner Area (Centered, x=80, width=240, height=240, top=30, bottom=270 - Lighter Gray Fill) -->
        <rect x="80" y="30" width="240" height="240" fill="rgba(203, 213, 225, 0.15)" stroke="rgba(203, 213, 225, 0.25)" stroke-width="1" />

        <!-- 2. Dynamic Liquid Fill -->
        <g v-if="levelPercent > 0">
          <!-- Liquid Body -->
          <path 
            :d="`M 80 ${270 - fillHeight} A 120 16 0 0 0 320 ${270 - fillHeight} L 320 270 A 120 16 0 0 1 80 270 Z`" 
            fill="url(#liquid-grad)" 
          />
          <!-- Liquid Top Ellipse (Waving Effect) -->
          <ellipse 
            cx="200" 
            :cy="270 - fillHeight" 
            rx="120" 
            ry="16" 
            fill="#00bcd4" 
            fill-opacity="0.9" 
            class="liquid-surface" 
          />
        </g>

        <!-- 3. Tank Outlines / Structural Cylindrical Lines (Lighter Gray Outlines) -->
        <!-- Top Ellipse -->
        <ellipse cx="200" cy="30" rx="120" ry="16" fill="none" stroke="rgba(203, 213, 225, 0.55)" stroke-width="2" />
        <!-- Bottom Ellipse Boundary -->
        <path d="M 80 270 A 120 16 0 0 0 320 270" fill="none" stroke="rgba(203, 213, 225, 0.55)" stroke-width="2" />
        <!-- Vertical Tank Walls -->
        <line x1="80" y1="30" x2="80" y2="270" stroke="rgba(203, 213, 225, 0.55)" stroke-width="2" />
        <line x1="320" y1="30" x2="320" y2="270" stroke="rgba(203, 213, 225, 0.55)" stroke-width="2" />

        <!-- 4. Agitator Shaft & Impeller (Rotating) -->
        <g class="agitator-group">
          <!-- Central Shaft -->
          <line x1="200" y1="18" x2="200" y2="250" stroke="#94a3b8" stroke-width="4" stroke-linecap="round" />
          
          <!-- Impeller Blades at 3 levels -->
          <!-- Top Blade -->
          <g class="agitator-blade blade-top">
            <path d="M 130 100 Q 200 104 270 100 Q 200 96 130 100" fill="#64748b" stroke="#475569" stroke-width="1" />
            <ellipse cx="200" cy="100" rx="8" ry="2.5" fill="#cbd5e1" />
          </g>
          <!-- Middle Blade -->
          <g class="agitator-blade blade-mid">
            <path d="M 125 165 Q 200 169 275 165 Q 200 161 125 165" fill="#64748b" stroke="#475569" stroke-width="1" />
            <ellipse cx="200" cy="165" rx="8" ry="2.5" fill="#cbd5e1" />
          </g>
          <!-- Bottom Blade -->
          <g class="agitator-blade blade-bot">
            <path d="M 130 230 Q 200 234 270 230 Q 200 226 130 230" fill="#64748b" stroke="#475569" stroke-width="1" />
            <ellipse cx="200" cy="230" rx="8" ry="2.5" fill="#cbd5e1" />
          </g>
        </g>

        <!-- 5. Top Mounts: Motor & Sensors -->
        <!-- Center Gearbox/Motor -->
        <rect x="186" y="8" width="28" height="18" rx="2" fill="url(#metal-grad)" stroke="#475569" stroke-width="1" />
        <rect x="194" y="2" width="12" height="6" rx="1" fill="#334155" />
        
        <!-- Radar Transmitter on top right -->
        <rect x="252" y="14" width="16" height="14" rx="1" fill="#475569" stroke="#64748b" stroke-width="1" />
        <path d="M 246 28 L 274 28 L 268 33 L 252 33 Z" fill="#334155" stroke="#475569" stroke-width="1" />

        <!-- 6. Pulsing Radar Sensor Wave -->
        <line 
          x1="260" 
          y1="33" 
          x2="260" 
          :y2="270 - fillHeight" 
          stroke="#ff3333" 
          stroke-width="1.8" 
          stroke-dasharray="4 4" 
          class="radar-beam" 
        />

        <!-- Water inlet pour pipe flow (pour from the top-left) -->
        <path v-if="flow && flow > 0" d="M 90 45 Q 100 45 102 80" stroke="#00d2ff" stroke-width="3" fill="none" class="water-flow" />
      </svg>
    </div>

    <!-- Live Telemetry bottom block -->
    <div class="scada-telemetry">
      <div class="tel-item">
        <span class="lbl">Liquid Level:</span>
        <span class="val text-mono" :style="{ color: statusColor }">
          {{ level === null || level === undefined ? '--' : level.toFixed(0) }} mm
        </span>
      </div>
      <div class="tel-item">
        <span class="lbl">Inlet Flow Rate:</span>
        <span class="val text-mono" style="color: var(--accent-cyan);">
          {{ flow === null || flow === undefined ? '--' : flow.toFixed(1) }} L/m
        </span>
      </div>
      <div class="tel-item">
        <span class="lbl">System Health:</span>
        <span class="status-badge-text" :style="{ color: statusColor, background: statusBg }">
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
  margin-bottom: 8px;
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
  min-height: 200px;
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

.tank-svg {
  z-index: 1;
  max-width: 420px;
}

/* =============================================================
   ANIMATIONS & SCADA STYLING
   ============================================================= */

/* Agitator rotation: 3D-like width scaling animation */
.agitator-blade {
  transform-origin: 200px 0px;
}
.blade-top {
  animation: spin-x 2.5s infinite ease-in-out;
}
.blade-mid {
  animation: spin-x 2.5s infinite ease-in-out;
  animation-delay: 0.4s;
}
.blade-bot {
  animation: spin-x 2.5s infinite ease-in-out;
  animation-delay: 0.8s;
}

@keyframes spin-x {
  0% {
    transform: scaleX(1);
  }
  50% {
    transform: scaleX(-1);
  }
  100% {
    transform: scaleX(1);
  }
}

/* Waving liquid surface effect */
.liquid-surface {
  animation: wave-surface 2s infinite ease-in-out;
}

@keyframes wave-surface {
  0%, 100% {
    rx: 80;
    ry: 11;
  }
  50% {
    rx: 81;
    ry: 13;
  }
}

/* Radar beam signal pulses */
.radar-beam {
  animation: radar-beam-pulse 1.2s infinite linear;
}

@keyframes radar-beam-pulse {
  0% {
    stroke-dashoffset: 0;
    opacity: 0.4;
  }
  50% {
    opacity: 0.9;
  }
  100% {
    stroke-dashoffset: -16;
    opacity: 0.4;
  }
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
  text-align: center;
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
</style>
