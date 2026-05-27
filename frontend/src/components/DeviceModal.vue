<script setup lang="ts">
import { ref, watch, computed } from 'vue';

const props = defineProps<{
  show: boolean;
  device: any | null; // Null means Add mode, object means Edit mode
}>();

const emit = defineEmits(['close', 'save']);

const slaveId = ref<number | null>(null);
const namaSensor = ref('');
const lokasi = ref('');
const setpointTemp = ref<number | null>(null);
const setpointZVel = ref<number | null>(null);
const setpointXVel = ref<number | null>(null);
const setpointZAcc = ref<number | null>(null);
const setpointXAcc = ref<number | null>(null);

const error = ref<string | null>(null);

const isEditMode = computed(() => !!props.device);

watch(() => props.show, (newVal) => {
  if (newVal) {
    error.value = null;
    if (props.device) {
      // Edit mode: populate values
      slaveId.value = props.device.slaveId;
      namaSensor.value = props.device.namaSensor;
      lokasi.value = props.device.lokasi;
      setpointTemp.value = props.device.setpointTemp;
      setpointZVel.value = props.device.setpointZVel;
      setpointXVel.value = props.device.setpointXVel;
      setpointZAcc.value = props.device.setpointZAcc;
      setpointXAcc.value = props.device.setpointXAcc;
    } else {
      // Add mode: reset values
      slaveId.value = null;
      namaSensor.value = '';
      lokasi.value = '';
      setpointTemp.value = 70; // Sensible defaults
      setpointZVel.value = 7.1;
      setpointXVel.value = 7.1;
      setpointZAcc.value = 10.0;
      setpointXAcc.value = 10.0;
    }
  }
});

async function handleSubmit() {
  if (!slaveId.value || !namaSensor.value || !lokasi.value) {
    error.value = 'Mohon lengkapi data wajib (Slave ID, Nama Sensor, & Lokasi)';
    return;
  }
  
  if (slaveId.value < 1 || slaveId.value > 247) {
    error.value = 'Slave ID harus bernilai antara 1 dan 247 (Modbus Standard)';
    return;
  }

  const payload = {
    slaveId: Number(slaveId.value),
    namaSensor: namaSensor.value,
    lokasi: lokasi.value,
    setpointTemp: setpointTemp.value !== null ? Number(setpointTemp.value) : null,
    setpointZVel: setpointZVel.value !== null ? Number(setpointZVel.value) : null,
    setpointXVel: setpointXVel.value !== null ? Number(setpointXVel.value) : null,
    setpointZAcc: setpointZAcc.value !== null ? Number(setpointZAcc.value) : null,
    setpointXAcc: setpointXAcc.value !== null ? Number(setpointXAcc.value) : null,
  };

  emit('save', payload);
}
</script>

<template>
  <div v-if="show" class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-content glass-panel">
      <div class="modal-header">
        <h3>{{ isEditMode ? 'Edit Perangkat Sensor' : 'Tambah Perangkat Sensor Baru' }}</h3>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>
      
      <div class="modal-body">
        <div v-if="error" class="error-banner">
          ⚠️ {{ error }}
        </div>
        
        <form @submit.prevent="handleSubmit" class="modal-form">
          <div class="form-grid">
            <!-- Basic Info Section -->
            <div class="form-section">
              <h4>Informasi Dasar Perangkat</h4>
              <div class="form-group">
                <label for="slave-id">Modbus Slave ID *</label>
                <input 
                  type="number" 
                  id="slave-id" 
                  v-model="slaveId" 
                  min="1" 
                  max="247"
                  placeholder="1 - 247"
                  required
                  :disabled="isEditMode"
                />
              </div>
              <div class="form-group">
                <label for="sensor-name">Nama Sensor / Objek *</label>
                <input 
                  type="text" 
                  id="sensor-name" 
                  v-model="namaSensor" 
                  placeholder="cth: Motor Pompa 3-Phase"
                  required
                />
              </div>
              <div class="form-group">
                <label for="location">Lokasi Unit *</label>
                <input 
                  type="text" 
                  id="location" 
                  v-model="lokasi" 
                  placeholder="cth: Power Plant Section A"
                  required
                />
              </div>
            </div>
            
            <!-- Setpoints / Alarms Section -->
            <div class="form-section">
              <h4>Batas Threshold Alarm (Setpoints)</h4>
              
              <div class="form-group row">
                <div class="col">
                  <label for="set-temp">Temp Limit (°C)</label>
                  <input type="number" step="0.1" id="set-temp" v-model="setpointTemp" />
                </div>
                <div class="col">
                  <label for="set-z-vel">Z-Velocity Limit (mm/s)</label>
                  <input type="number" step="0.05" id="set-z-vel" v-model="setpointZVel" />
                </div>
              </div>

              <div class="form-group row">
                <div class="col">
                  <label for="set-x-vel">X-Velocity Limit (mm/s)</label>
                  <input type="number" step="0.05" id="set-x-vel" v-model="setpointXVel" />
                </div>
                <div class="col">
                  <label for="set-z-acc">Z-Acceleration Limit (mm/s²)</label>
                  <input type="number" step="0.05" id="set-z-acc" v-model="setpointZAcc" />
                </div>
              </div>

              <div class="form-group">
                <label for="set-x-acc">X-Acceleration Limit (mm/s²)</label>
                <input type="number" step="0.05" id="set-x-acc" v-model="setpointXAcc" />
              </div>
            </div>
          </div>
          
          <div class="modal-actions">
            <button type="button" @click="emit('close')" class="btn-cancel">Batal</button>
            <button type="submit" class="btn-submit">
              {{ isEditMode ? 'Simpan Perubahan' : 'Daftarkan Perangkat 🚀' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(6, 8, 20, 0.7);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-content {
  width: 100%;
  max-width: 800px;
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
  align-items: center;
}

.modal-header h3 {
  font-size: 1.2rem;
  font-weight: 700;
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 1.1rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.close-btn:hover {
  color: var(--text-primary);
}

.modal-body {
  padding: 24px;
}

.error-banner {
  background: var(--status-critical-glow);
  color: var(--status-critical);
  border: 1px solid rgba(239, 68, 68, 0.2);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 0.85rem;
  font-weight: 600;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
}

@media (max-width: 650px) {
  .form-grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }
}

.form-section h4 {
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--accent-cyan);
  margin-bottom: 16px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.form-group.row {
  flex-direction: row;
  gap: 16px;
}

.form-group .col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
}

input {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 10px 14px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 0.9rem;
}

input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid var(--border-color);
  padding-top: 20px;
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 10px 20px;
  border-radius: 8px;
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
}

.btn-cancel:hover {
  background: var(--bg-input-hover);
  color: var(--text-primary);
}

.btn-submit {
  background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
  border: none;
  color: white;
  padding: 10px 24px;
  border-radius: 8px;
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
}

.btn-submit:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.45);
}
</style>
