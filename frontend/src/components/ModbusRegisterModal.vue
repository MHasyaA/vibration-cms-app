<script setup lang="ts">
import { ref, watch, computed } from 'vue';

const props = defineProps<{
  show: boolean;
  device: any | null;
  connections: any[];
}>();

const emit = defineEmits(['close', 'save']);

const connectionId = ref<number | null>(null);
const regTemp = ref<number | null>(null);
const regZVel = ref<number | null>(null);
const regXVel = ref<number | null>(null);
const regZAcc = ref<number | null>(null);
const regXAcc = ref<number | null>(null);
const regDataType = ref('float32');
const regByteOrder = ref('BE');

const scaleTemp = ref<number>(1.0);
const scaleZVel = ref<number>(1.0);
const scaleXVel = ref<number>(1.0);
const scaleZAcc = ref<number>(1.0);
const scaleXAcc = ref<number>(1.0);

const regPressure = ref<number | null>(null);
const regFlow = ref<number | null>(null);
const regLevel = ref<number | null>(null);
const scalePressure = ref<number>(1.0);
const scaleFlow = ref<number>(1.0);
const scaleLevel = ref<number>(1.0);
const offsetPressure = ref<number>(0.0);
const offsetFlow = ref<number>(0.0);
const offsetLevel = ref<number>(0.0);

const error = ref<string | null>(null);

const deviceName = computed(() => props.device?.namaSensor || '');
const slaveId = computed(() => props.device?.slaveId || '');

watch(() => props.show, (newVal) => {
  if (newVal && props.device) {
    error.value = null;
    connectionId.value = props.device.connectionId ?? null;
    regTemp.value = props.device.regTemp ?? null;
    regZVel.value = props.device.regZVel ?? null;
    regXVel.value = props.device.regXVel ?? null;
    regZAcc.value = props.device.regZAcc ?? null;
    regXAcc.value = props.device.regXAcc ?? null;
    regDataType.value = props.device.regDataType || 'float32';
    regByteOrder.value = props.device.regByteOrder || 'BE';
    scaleTemp.value = props.device.scaleTemp ?? 1.0;
    scaleZVel.value = props.device.scaleZVel ?? 1.0;
    scaleXVel.value = props.device.scaleXVel ?? 1.0;
    scaleZAcc.value = props.device.scaleZAcc ?? 1.0;
    scaleXAcc.value = props.device.scaleXAcc ?? 1.0;
    regPressure.value = props.device.regPressure ?? null;
    regFlow.value = props.device.regFlow ?? null;
    regLevel.value = props.device.regLevel ?? null;
    scalePressure.value = props.device.scalePressure ?? 1.0;
    scaleFlow.value = props.device.scaleFlow ?? 1.0;
    scaleLevel.value = props.device.scaleLevel ?? 1.0;
    offsetPressure.value = props.device.offsetPressure ?? 0.0;
    offsetFlow.value = props.device.offsetFlow ?? 0.0;
    offsetLevel.value = props.device.offsetLevel ?? 0.0;
  }
});

function handleSubmit() {
  const payload = {
    connectionId: connectionId.value,
    regTemp: regTemp.value !== null && regTemp.value !== undefined ? Number(regTemp.value) : null,
    regZVel: regZVel.value !== null && regZVel.value !== undefined ? Number(regZVel.value) : null,
    regXVel: regXVel.value !== null && regXVel.value !== undefined ? Number(regXVel.value) : null,
    regZAcc: regZAcc.value !== null && regZAcc.value !== undefined ? Number(regZAcc.value) : null,
    regXAcc: regXAcc.value !== null && regXAcc.value !== undefined ? Number(regXAcc.value) : null,
    regDataType: regDataType.value,
    regByteOrder: regByteOrder.value,
    scaleTemp: scaleTemp.value !== null && scaleTemp.value !== undefined ? Number(scaleTemp.value) : 1.0,
    scaleZVel: scaleZVel.value !== null && scaleZVel.value !== undefined ? Number(scaleZVel.value) : 1.0,
    scaleXVel: scaleXVel.value !== null && scaleXVel.value !== undefined ? Number(scaleXVel.value) : 1.0,
    scaleZAcc: scaleZAcc.value !== null && scaleZAcc.value !== undefined ? Number(scaleZAcc.value) : 1.0,
    scaleXAcc: scaleXAcc.value !== null && scaleXAcc.value !== undefined ? Number(scaleXAcc.value) : 1.0,
    regPressure: regPressure.value !== null && regPressure.value !== undefined ? Number(regPressure.value) : null,
    regFlow: regFlow.value !== null && regFlow.value !== undefined ? Number(regFlow.value) : null,
    regLevel: regLevel.value !== null && regLevel.value !== undefined ? Number(regLevel.value) : null,
    scalePressure: scalePressure.value !== null && scalePressure.value !== undefined ? Number(scalePressure.value) : 1.0,
    scaleFlow: scaleFlow.value !== null && scaleFlow.value !== undefined ? Number(scaleFlow.value) : 1.0,
    scaleLevel: scaleLevel.value !== null && scaleLevel.value !== undefined ? Number(scaleLevel.value) : 1.0,
    offsetPressure: offsetPressure.value !== null && offsetPressure.value !== undefined ? Number(offsetPressure.value) : 0.0,
    offsetFlow: offsetFlow.value !== null && offsetFlow.value !== undefined ? Number(offsetFlow.value) : 0.0,
    offsetLevel: offsetLevel.value !== null && offsetLevel.value !== undefined ? Number(offsetLevel.value) : 0.0,
  };
  emit('save', payload);
}
</script>

<template>
  <div v-if="show" class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-content glass-panel">
      <div class="modal-header">
        <div>
          <h3>Konfigurasi Register Modbus</h3>
          <p class="modal-sub">{{ deviceName }} &mdash; Slave #{{ slaveId }}</p>
        </div>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <div v-if="error" class="error-banner">⚠️ {{ error }}</div>

        <form @submit.prevent="handleSubmit" class="modal-form">
          
          <!-- Connection Selection -->
          <div class="form-section">
            <h4>Koneksi Modbus TCP</h4>
            <div class="form-group">
              <label for="conn-select">Pilih IP & Port Modbus TCP</label>
              <select id="conn-select" v-model="connectionId">
                <option :value="null">— Belum dikonfigurasi —</option>
                <option v-for="c in connections" :key="c.id" :value="c.id">
                  {{ c.ipAddress }}:{{ c.tcpPort }}
                  {{ c.isActive ? '● Aktif' : '○ Non-aktif' }}
                </option>
              </select>
            </div>
          </div>

          <!-- Register Address Mapping -->
          <div class="form-section">
            <h4>Alamat Register Holding & Faktor Skala (Scaling)</h4>
            <div class="reg-rows-container">
              <div class="reg-row-item">
                <span class="reg-row-label">Temperatur (°C)</span>
                <div class="reg-inputs-pair">
                  <div class="input-with-label">
                    <span class="field-hint">Register</span>
                    <input type="number" v-model="regTemp" min="0" max="65535" placeholder="misal: 0" class="text-mono input-addr" />
                  </div>
                  <div class="input-with-label">
                    <span class="field-hint">Faktor Skala (Multiplier)</span>
                    <div class="scale-input-wrapper">
                      <span class="mult-symbol">×</span>
                      <input type="number" v-model="scaleTemp" step="any" placeholder="1.0" class="text-mono input-scale" />
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="reg-row-item">
                <span class="reg-row-label">Velocity Z (mm/s)</span>
                <div class="reg-inputs-pair">
                  <div class="input-with-label">
                    <span class="field-hint">Register</span>
                    <input type="number" v-model="regZVel" min="0" max="65535" placeholder="misal: 2" class="text-mono input-addr" />
                  </div>
                  <div class="input-with-label">
                    <span class="field-hint">Faktor Skala (Multiplier)</span>
                    <div class="scale-input-wrapper">
                      <span class="mult-symbol">×</span>
                      <input type="number" v-model="scaleZVel" step="any" placeholder="1.0" class="text-mono input-scale" />
                    </div>
                  </div>
                </div>
              </div>

              <div class="reg-row-item">
                <span class="reg-row-label">Velocity X (mm/s)</span>
                <div class="reg-inputs-pair">
                  <div class="input-with-label">
                    <span class="field-hint">Register</span>
                    <input type="number" v-model="regXVel" min="0" max="65535" placeholder="misal: 4" class="text-mono input-addr" />
                  </div>
                  <div class="input-with-label">
                    <span class="field-hint">Faktor Skala (Multiplier)</span>
                    <div class="scale-input-wrapper">
                      <span class="mult-symbol">×</span>
                      <input type="number" v-model="scaleXVel" step="any" placeholder="1.0" class="text-mono input-scale" />
                    </div>
                  </div>
                </div>
              </div>

              <div class="reg-row-item">
                <span class="reg-row-label">Acceleration Z (mm/s²)</span>
                <div class="reg-inputs-pair">
                  <div class="input-with-label">
                    <span class="field-hint">Register</span>
                    <input type="number" v-model="regZAcc" min="0" max="65535" placeholder="misal: 6" class="text-mono input-addr" />
                  </div>
                  <div class="input-with-label">
                    <span class="field-hint">Faktor Skala (Multiplier)</span>
                    <div class="scale-input-wrapper">
                      <span class="mult-symbol">×</span>
                      <input type="number" v-model="scaleZAcc" step="any" placeholder="1.0" class="text-mono input-scale" />
                    </div>
                  </div>
                </div>
              </div>

              <div class="reg-row-item">
                <span class="reg-row-label">Acceleration X (mm/s²)</span>
                <div class="reg-inputs-pair">
                  <div class="input-with-label">
                    <span class="field-hint">Register</span>
                    <input type="number" v-model="regXAcc" min="0" max="65535" placeholder="misal: 8" class="text-mono input-addr" />
                  </div>
                  <div class="input-with-label">
                    <span class="field-hint">Faktor Skala (Multiplier)</span>
                    <div class="scale-input-wrapper">
                      <span class="mult-symbol">×</span>
                      <input type="number" v-model="scaleXAcc" step="any" placeholder="1.0" class="text-mono input-scale" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- New registers: Pressure, Flow, Level with custom Calibration formula -->
              <div class="reg-row-item">
                <span class="reg-row-label">Pressure (Bar)</span>
                <div class="reg-inputs-pair">
                  <div class="input-with-label">
                    <span class="field-hint">Register</span>
                    <input type="number" v-model="regPressure" min="0" max="65535" placeholder="misal: 10" class="text-mono input-addr" />
                  </div>
                  <div class="input-with-label">
                    <span class="field-hint">Offset (Pengurang)</span>
                    <input type="number" v-model="offsetPressure" step="any" placeholder="0.0" class="text-mono input-addr" />
                  </div>
                  <div class="input-with-label">
                    <span class="field-hint">Skala (Pembagi)</span>
                    <div class="scale-input-wrapper">
                      <span class="mult-symbol">÷</span>
                      <input type="number" v-model="scalePressure" step="any" placeholder="1.0" class="text-mono input-scale" />
                    </div>
                  </div>
                </div>
              </div>

              <div class="reg-row-item">
                <span class="reg-row-label">Flow (L/min)</span>
                <div class="reg-inputs-pair">
                  <div class="input-with-label">
                    <span class="field-hint">Register</span>
                    <input type="number" v-model="regFlow" min="0" max="65535" placeholder="misal: 12" class="text-mono input-addr" />
                  </div>
                  <div class="input-with-label">
                    <span class="field-hint">Offset (Pengurang)</span>
                    <input type="number" v-model="offsetFlow" step="any" placeholder="0.0" class="text-mono input-addr" />
                  </div>
                  <div class="input-with-label">
                    <span class="field-hint">Skala (Pembagi)</span>
                    <div class="scale-input-wrapper">
                      <span class="mult-symbol">÷</span>
                      <input type="number" v-model="scaleFlow" step="any" placeholder="1.0" class="text-mono input-scale" />
                    </div>
                  </div>
                </div>
              </div>

              <div class="reg-row-item">
                <span class="reg-row-label">Level (mm)</span>
                <div class="reg-inputs-pair">
                  <div class="input-with-label">
                    <span class="field-hint">Register</span>
                    <input type="number" v-model="regLevel" min="0" max="65535" placeholder="misal: 14" class="text-mono input-addr" />
                  </div>
                  <div class="input-with-label">
                    <span class="field-hint">Offset (Pengurang)</span>
                    <input type="number" v-model="offsetLevel" step="any" placeholder="0.0" class="text-mono input-addr" />
                  </div>
                  <div class="input-with-label">
                    <span class="field-hint">Skala (Pembagi)</span>
                    <div class="scale-input-wrapper">
                      <span class="mult-symbol">÷</span>
                      <input type="number" v-model="scaleLevel" step="any" placeholder="1.0" class="text-mono input-scale" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="info-note" style="margin-top: 15px;">
              💡 <strong>Informasi Penskalaan (Scaling):</strong> Gunakan faktor skala jika data raw register dari perangkat berupa integer tetapi mewakili pecahan decimal. Misalnya, jika data suhu di register bernilai <code>2535</code> dan suhu aktualnya <code>25.35 °C</code>, isi Faktor Skala dengan <code>0.01</code>. Jika tidak memerlukan penskalaan, biarkan <code>1.0</code>.
            </div>
          </div>

          <!-- Data Type & Byte Order -->
          <div class="form-section">
            <h4>Format Data Register</h4>
            <div class="form-row">
              <div class="form-group">
                <label>Tipe Data</label>
                <select v-model="regDataType">
                  <option value="float32">float32 (2 register per nilai)</option>
                  <option value="int16">int16 (1 register per nilai, signed)</option>
                  <option value="uint16">uint16 (1 register per nilai, unsigned)</option>
                </select>
              </div>
              <div class="form-group">
                <label>Byte Order</label>
                <select v-model="regByteOrder">
                  <option value="BE">Big Endian (BE) — default</option>
                  <option value="LE">Little Endian (LE)</option>
                </select>
              </div>
            </div>
            <div class="info-note">
              Untuk sensor vibrasi standar Modbus, biasanya <code>float32 BE</code>. Cek datasheet sensor Anda.
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" @click="emit('close')" class="btn-cancel">Batal</button>
            <button type="submit" class="btn-submit">Simpan Konfigurasi</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(6, 8, 20, 0.75);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-content {
  width: 100%;
  max-width: 720px;
  background: var(--bg-panel-solid);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.modal-header h3 { font-size: 1.1rem; font-weight: 700; }
.modal-sub { font-size: 0.8rem; color: var(--accent-primary); margin-top: 4px; font-weight: 600; font-family: 'JetBrains Mono', monospace; }

.close-btn { background: transparent; border: none; font-size: 1.1rem; color: var(--text-secondary); cursor: pointer; }
.close-btn:hover { color: var(--text-primary); }

.modal-body { padding: 24px; }

.error-banner {
  background: var(--status-critical-glow);
  color: var(--status-critical);
  border: 1px solid rgba(239, 68, 68, 0.2);
  padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 0.85rem; font-weight: 600;
}

.modal-form { display: flex; flex-direction: column; gap: 20px; }

.form-section {}
.form-section h4 {
  font-size: 0.78rem;
  font-weight: 800;
  color: var(--accent-cyan);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.reg-rows-container {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.reg-row-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.015);
  border: 1px solid var(--border-color);
  padding: 10px 14px;
  border-radius: 10px;
  gap: 16px;
}

.reg-row-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-primary);
  min-width: 150px;
}

.reg-inputs-pair {
  display: flex;
  gap: 12px;
  flex-grow: 1;
}

.input-with-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.field-hint {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.scale-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.mult-symbol {
  position: absolute;
  left: 10px;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--accent-primary);
}

.input-addr {
  width: 100%;
}

.input-scale {
  width: 100%;
  padding-left: 24px !important;
}

.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

.form-group { display: flex; flex-direction: column; gap: 6px; }

label { font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); }

input, select {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 10px 12px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 0.9rem;
}

input:focus, select:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(0, 210, 255, 0.12);
}

.text-mono { font-family: 'JetBrains Mono', monospace !important; }

select option { background: var(--bg-panel-solid); }

.info-note {
  margin-top: 10px;
  font-size: 0.78rem;
  color: var(--text-muted);
  padding: 8px 12px;
  background: rgba(0, 210, 255, 0.04);
  border-radius: 6px;
  border-left: 2px solid var(--accent-primary);
}

.info-note code {
  font-family: 'JetBrains Mono', monospace;
  color: var(--accent-primary);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid var(--border-color);
  padding-top: 16px;
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 10px 20px; border-radius: 8px; font-family: inherit; font-weight: 600; cursor: pointer;
}
.btn-cancel:hover { background: var(--bg-input-hover); color: var(--text-primary); }

.btn-submit {
  background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
  border: none; color: white; padding: 10px 24px; border-radius: 8px; font-family: inherit; font-weight: 600; cursor: pointer;
  box-shadow: 0 4px 15px rgba(0, 210, 255, 0.25);
}
.btn-submit:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0, 210, 255, 0.4); }
</style>
