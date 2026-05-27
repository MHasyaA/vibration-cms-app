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
            <h4>Koneksi Serial</h4>
            <div class="form-group">
              <label for="conn-select">Bus RS485 / COM Port</label>
              <select id="conn-select" v-model="connectionId">
                <option :value="null">— Belum dikonfigurasi —</option>
                <option v-for="c in connections" :key="c.id" :value="c.id">
                  {{ c.portName }} ({{ c.baudRate }} baud, {{ c.dataBits }}{{ c.parity.charAt(0).toUpperCase() }}{{ c.stopBits }})
                  {{ c.isActive ? '● Aktif' : '○ Non-aktif' }}
                </option>
              </select>
            </div>
          </div>

          <!-- Register Address Mapping -->
          <div class="form-section">
            <h4>Alamat Register Holding (Modbus Address)</h4>
            <div class="reg-grid">
              <div class="form-group">
                <label>Reg. Temperatur</label>
                <input type="number" v-model="regTemp" min="0" max="65535" placeholder="misal: 0" class="text-mono" />
              </div>
              <div class="form-group">
                <label>Reg. Vel-Z (mm/s)</label>
                <input type="number" v-model="regZVel" min="0" max="65535" placeholder="misal: 2" class="text-mono" />
              </div>
              <div class="form-group">
                <label>Reg. Vel-X (mm/s)</label>
                <input type="number" v-model="regXVel" min="0" max="65535" placeholder="misal: 4" class="text-mono" />
              </div>
              <div class="form-group">
                <label>Reg. Acc-Z (mm/s²)</label>
                <input type="number" v-model="regZAcc" min="0" max="65535" placeholder="misal: 6" class="text-mono" />
              </div>
              <div class="form-group">
                <label>Reg. Acc-X (mm/s²)</label>
                <input type="number" v-model="regXAcc" min="0" max="65535" placeholder="misal: 8" class="text-mono" />
              </div>
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

.reg-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
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
