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
  const maxCapacity = limitLevel.value * 1.43;
  return Math.min(Math.round((props.level / maxCapacity) * 100), 100);
});

// SVG tank inner area: x=80 -> 320, y=30 -> 270 (height 240)
const fillHeight = computed(() => {
  return 5 + (levelPercent.value / 100) * 220;
});

const status = computed(() => {
  if (props.level === null || props.level === undefined || !limitLevel.value) return 'safe';
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

// Scale ticks along the tank height (every 20%)
const scaleTicks = [0, 20, 40, 60, 80, 100];
const tickY = (pct: number) => 270 - (pct / 100) * 220;
</script>

<template>
  <div class="scada-svg-container glass-panel">
    <div class="scada-meta">
      <span class="scada-tag">MODEL SCADA INTERAKTIF</span>
      <h3 class="scada-title">{{ sensorName }}</h3>
    </div>

    <div class="canvas-area">
      <div class="glow-bg" :style="{ background: `radial-gradient(ellipse at center, ${statusColor} 0%, transparent 60%)`, opacity: 0.15 }"></div>

      <svg class="tank-svg" viewBox="0 0 400 300" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="liquid-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#4dd8ec" stop-opacity="0.9" />
            <stop offset="40%" stop-color="#00acc1" stop-opacity="0.75" />
            <stop offset="100%" stop-color="#01579b" stop-opacity="0.65" />
          </linearGradient>

          <linearGradient id="liquid-highlight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
          </linearGradient>

          <linearGradient id="metal-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#3f4b5b" />
            <stop offset="18%" stop-color="#64748b" />
            <stop offset="42%" stop-color="#aab4c2" />
            <stop offset="50%" stop-color="#c7d0da" />
            <stop offset="58%" stop-color="#aab4c2" />
            <stop offset="82%" stop-color="#64748b" />
            <stop offset="100%" stop-color="#3f4b5b" />
          </linearGradient>

          <linearGradient id="glass-sheen" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0" />
            <stop offset="30%" stop-color="#ffffff" stop-opacity="0.18" />
            <stop offset="38%" stop-color="#ffffff" stop-opacity="0" />
          </linearGradient>

          <radialGradient id="rivet-grad" cx="35%" cy="35%" r="70%">
            <stop offset="0%" stop-color="#e2e8f0" />
            <stop offset="100%" stop-color="#475569" />
          </radialGradient>

          <clipPath id="tank-clip">
            <rect x="81" y="30" width="238" height="240" />
          </clipPath>
        </defs>

        <!-- Tank body -->
        <rect x="80" y="30" width="240" height="240" fill="url(#metal-grad)" fill-opacity="0.22" stroke="rgba(203, 213, 225, 0.3)" stroke-width="1" />

        <!-- Liquid, clipped to tank interior -->
        <g clip-path="url(#tank-clip)">
          <g v-if="levelPercent > 0">
            <path
              :d="`M 80 ${270 - fillHeight} A 120 16 0 0 0 320 ${270 - fillHeight} L 320 270 A 120 16 0 0 1 80 270 Z`"
              fill="url(#liquid-grad)"
            />
            <path
              :d="`M 80 ${270 - fillHeight} A 120 16 0 0 0 320 ${270 - fillHeight} L 320 ${270 - fillHeight + 18} A 120 16 0 0 1 80 ${270 - fillHeight + 18} Z`"
              fill="url(#liquid-highlight)"
            />
            <ellipse
              cx="200"
              :cy="270 - fillHeight"
              rx="120"
              ry="16"
              fill="#4dd8ec"
              fill-opacity="0.85"
              class="liquid-surface"
            />
            <ellipse
              cx="200"
              :cy="270 - fillHeight"
              rx="118"
              ry="14.5"
              fill="none"
              stroke="#ffffff"
              stroke-opacity="0.4"
              stroke-width="1"
              class="liquid-surface"
            />
          </g>
          <!-- Vertical glass sheen across the whole tank -->
          <rect x="80" y="30" width="240" height="240" fill="url(#glass-sheen)" />
        </g>

        <!-- Level scale ticks -->
        <g class="scale-ticks">
          <g v-for="pct in scaleTicks" :key="pct">
            <line :x1="322" :y1="tickY(pct)" :x2="330" :y2="tickY(pct)" stroke="rgba(203, 213, 225, 0.6)" stroke-width="1.5" />
            <text :x="334" :y="tickY(pct) + 3" font-size="8" fill="rgba(203, 213, 225, 0.75)">{{ pct }}%</text>
          </g>
        </g>

        <!-- Structural outlines -->
        <ellipse cx="200" cy="30" rx="120" ry="16" fill="none" stroke="rgba(203, 213, 225, 0.55)" stroke-width="2" />
        <path d="M 80 270 A 120 16 0 0 0 320 270" fill="none" stroke="rgba(203, 213, 225, 0.55)" stroke-width="2" />
        <line x1="80" y1="30" x2="80" y2="270" stroke="rgba(203, 213, 225, 0.55)" stroke-width="2" />
        <line x1="320" y1="30" x2="320" y2="270" stroke="rgba(203, 213, 225, 0.55)" stroke-width="2" />

        <!-- Bolted seam rings for realism -->
        <g class="seam-ring">
          <path d="M 80 110 A 120 16 0 0 0 320 110" fill="none" stroke="rgba(148, 163, 184, 0.4)" stroke-width="1.2" />
          <circle v-for="i in 11" :key="'s1-'+i" :cx="86 + i * 21" cy="110" r="2" fill="url(#rivet-grad)" />
        </g>
        <g class="seam-ring">
          <path d="M 80 190 A 120 16 0 0 0 320 190" fill="none" stroke="rgba(148, 163, 184, 0.4)" stroke-width="1.2" />
          <circle v-for="i in 11" :key="'s2-'+i" :cx="86 + i * 21" cy="190" r="2" fill="url(#rivet-grad)" />
        </g>

        <!-- Support legs -->
        <line x1="100" y1="270" x2="94" y2="292" stroke="#475569" stroke-width="6" stroke-linecap="round" />
        <line x1="300" y1="270" x2="306" y2="292" stroke="#475569" stroke-width="6" stroke-linecap="round" />

        <!-- Agitator shaft & impeller -->
        <g class="agitator-group">
          <line x1="200" y1="42" x2="200" y2="250" stroke="#94a3b8" stroke-width="4" stroke-linecap="round" />
          <g class="agitator-blade blade-top">
            <path d="M 130 100 Q 200 104 270 100 Q 200 96 130 100" fill="#64748b" stroke="#475569" stroke-width="1" />
            <ellipse cx="200" cy="100" rx="8" ry="2.5" fill="#cbd5e1" />
          </g>
          <g class="agitator-blade blade-mid">
            <path d="M 125 165 Q 200 169 275 165 Q 200 161 125 165" fill="#64748b" stroke="#475569" stroke-width="1" />
            <ellipse cx="200" cy="165" rx="8" ry="2.5" fill="#cbd5e1" />
          </g>
          <g class="agitator-blade blade-bot">
            <path d="M 130 230 Q 200 234 270 230 Q 200 226 130 230" fill="#64748b" stroke="#475569" stroke-width="1" />
            <ellipse cx="200" cy="230" rx="8" ry="2.5" fill="#cbd5e1" />
          </g>
        </g>

        <!-- Motor / gearbox on top -->
        <rect x="186" y="8" width="28" height="18" rx="2" fill="url(#metal-grad)" stroke="#475569" stroke-width="1" />
        <rect x="194" y="2" width="12" height="6" rx="1" fill="#334155" />
        <circle cx="200" cy="17" r="1.4" fill="#0f172a" />

        <!-- Radar level transmitter: small rectangular housing + horn antenna -->
        <g class="radar-sensor">
          <rect x="253" y="6" width="15" height="4" rx="1" fill="#475569" />
          <rect x="252" y="10" width="17" height="15" rx="1.5" fill="url(#metal-grad)" stroke="#334155" stroke-width="1" />
          <circle cx="256" cy="17" r="1.1" fill="#22c55e" class="radar-led" />
          <path d="M 254 25 L 267 25 L 264 31 L 257 31 Z" fill="#334155" stroke="#1e293b" stroke-width="0.8" />
        </g>

        <!-- Radar beam pulse -->
        <line
          x1="260.5"
          y1="31"
          x2="260.5"
          :y2="270 - fillHeight"
          stroke="#ff4d4d"
          stroke-width="1.4"
          stroke-dasharray="3 5"
          class="radar-beam"
        />
        <ellipse
          cx="260.5"
          :cy="270 - fillHeight"
          rx="10"
          ry="2.5"
          fill="none"
          stroke="#ff4d4d"
          stroke-opacity="0.5"
          stroke-width="1"
          class="radar-echo"
        />

        <!-- Inlet flow pipe -->
        <path v-if="flow && flow > 0" d="M 90 45 Q 100 45 102 80" stroke="#00d2ff" stroke-width="3" fill="none" class="water-flow" />
        <circle v-if="flow && flow > 0" cx="102" cy="80" r="2.5" fill="#00d2ff" class="drip" />

        <!-- Outlet / drain valve -->
        <rect x="196" y="270" width="8" height="10" fill="#475569" />
        <circle cx="200" cy="284" r="5" fill="url(#metal-grad)" stroke="#334155" stroke-width="1" />
      </svg>
    </div>

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
  0% { transform: scaleX(1); }
  50% { transform: scaleX(-1); }
  100% { transform: scaleX(1); }
}

.liquid-surface {
  animation: wave-surface 2s infinite ease-in-out;
}

@keyframes wave-surface {
  0%, 100% { ry: 16; }
  50% { ry: 13; }
}

.radar-beam {
  animation: radar-beam-pulse 1.2s infinite linear;
}

@keyframes radar-beam-pulse {
  0% { stroke-dashoffset: 0; opacity: 0.4; }
  50% { opacity: 0.9; }
  100% { stroke-dashoffset: -16; opacity: 0.4; }
}

.radar-echo {
  animation: echo-pulse 1.2s infinite ease-out;
}

@keyframes echo-pulse {
  0% { opacity: 0.7; transform: scale(0.6); }
  100% { opacity: 0; transform: scale(1.6); }
}

.radar-led {
  animation: led-blink 1.6s infinite ease-in-out;
}

@keyframes led-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

.water-flow {
  stroke-dasharray: 4 3;
  animation: flow-dash 0.6s linear infinite;
}

@keyframes flow-dash {
  to { stroke-dashoffset: -7; }
}

.drip {
  animation: drip-fall 0.9s infinite ease-in;
}

@keyframes drip-fall {
  0% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(14px); }
}

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
