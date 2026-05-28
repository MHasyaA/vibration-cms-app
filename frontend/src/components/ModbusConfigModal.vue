<script setup lang="ts">
import { ref, watch, computed } from 'vue';

const props = defineProps<{
  show: boolean;
  connection: any | null; // null = Add mode, object = Edit mode
}>();

const emit = defineEmits(['close', 'save']);

const ipAddress = ref('');
const tcpPort = ref(502);
const timeout = ref(1000);
const pollInterval = ref(5000);
const isActive = ref(false);

const error = ref<string | null>(null);
const isEditMode = computed(() => !!props.connection);

watch(() => props.show, (newVal) => {
  if (newVal) {
    error.value = null;
    if (props.connection) {
      ipAddress.value = props.connection.ipAddress;
      tcpPort.value = props.connection.tcpPort;
      timeout.value = props.connection.timeout;
      pollInterval.value = props.connection.pollInterval;
      isActive.value = props.connection.isActive;
    } else {
      ipAddress.value = '';
      tcpPort.value = 502;
      timeout.value = 1000;
      pollInterval.value = 5000;
      isActive.value = false;
    }
  }
});

function handleSubmit() {
  if (!ipAddress.value) {
    error.value = 'IP Address / Hostname wajib diisi (contoh: 192.168.1.100 atau localhost)';
    return;
  }

  const payload = {
    ipAddress: ipAddress.value.trim(),
    tcpPort: Number(tcpPort.value),
    timeout: Number(timeout.value),
    pollInterval: Number(pollInterval.value),
    isActive: isActive.value,
  };

  emit('save', payload);
}
</script>

<template>
  <div v-if="show" class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-content glass-panel">
      <div class="modal-header">
        <h3>{{ isEditMode ? 'Edit Koneksi Modbus TCP' : 'Tambah Koneksi Modbus TCP Baru' }}</h3>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <div v-if="error" class="error-banner">⚠️ {{ error }}</div>

        <form @submit.prevent="handleSubmit" class="modal-form">
          <!-- IP & Port -->
          <div class="form-row">
            <div class="form-group">
              <label for="ip-address">IP Address / Hostname *</label>
              <input
                type="text"
                id="ip-address"
                v-model="ipAddress"
                placeholder="contoh: 192.168.1.100 atau localhost"
                required
              />
              <span class="hint">Alamat IP gateway atau device Modbus TCP</span>
            </div>
            <div class="form-group">
              <label for="tcp-port">TCP Port *</label>
              <input
                type="number"
                id="tcp-port"
                v-model="tcpPort"
                min="1"
                max="65535"
                required
              />
              <span class="hint">Port TCP standar Modbus adalah 502</span>
            </div>
          </div>

          <!-- Timeout & Poll Interval -->
          <div class="form-row">
            <div class="form-group">
              <label for="timeout">Timeout (ms)</label>
              <input type="number" id="timeout" v-model="timeout" min="100" step="100" />
              <span class="hint">Waktu tunggu respons Modbus slave</span>
            </div>
            <div class="form-group">
              <label for="poll-interval">Poll Interval (ms)</label>
              <input type="number" id="poll-interval" v-model="pollInterval" min="500" step="500" />
              <span class="hint">Interval baca data antar polling cycle</span>
            </div>
          </div>

          <!-- Active Toggle -->
          <div class="form-group toggle-group">
            <label class="toggle-label">
              <div class="toggle-wrap">
                <input type="checkbox" id="is-active" v-model="isActive" class="toggle-input" />
                <div class="toggle-track" :class="{ active: isActive }">
                  <div class="toggle-thumb"></div>
                </div>
              </div>
              <span>Aktifkan Polling</span>
            </label>
            <span class="hint">{{ isActive ? 'Sistem akan mulai membaca sensor saat server restart' : 'Polling tidak akan berjalan' }}</span>
          </div>

          <!-- Mode summary badge -->
          <div class="settings-badge text-mono">
            {{ ipAddress || 'IP_ADDRESS' }} : {{ tcpPort }}
          </div>

          <div class="modal-actions">
            <button type="button" @click="emit('close')" class="btn-cancel">Batal</button>
            <button type="submit" class="btn-submit">
              {{ isEditMode ? 'Simpan Perubahan' : 'Tambah Koneksi' }}
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
  max-width: 680px;
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
  font-size: 1.1rem;
  font-weight: 700;
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 1.1rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.close-btn:hover { color: var(--text-primary); }

.modal-body { padding: 24px; }

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
  gap: 16px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-row.three-col {
  grid-template-columns: 1fr 1fr 1fr;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
}

input, select {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 10px 14px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 0.9rem;
}

input:focus, select:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(0, 210, 255, 0.12);
}

select option { background: var(--bg-panel-solid); }

.hint {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-style: italic;
}

.toggle-group { flex-direction: column; gap: 8px; }

.toggle-label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.toggle-wrap { display: flex; align-items: center; }

.toggle-input { display: none; }

.toggle-track {
  width: 44px;
  height: 24px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 99px;
  position: relative;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}

.toggle-track.active {
  background: rgba(0, 210, 255, 0.2);
  border-color: var(--accent-primary);
}

.toggle-thumb {
  position: absolute;
  top: 3px; left: 3px;
  width: 16px; height: 16px;
  background: var(--text-muted);
  border-radius: 50%;
  transition: left 0.2s, background 0.2s;
}

.toggle-track.active .toggle-thumb {
  left: 23px;
  background: var(--accent-primary);
  box-shadow: 0 0 8px var(--accent-primary);
}

.settings-badge {
  padding: 10px 16px;
  background: rgba(0, 210, 255, 0.06);
  border: 1px solid rgba(0, 210, 255, 0.2);
  border-radius: 8px;
  font-size: 0.85rem;
  color: var(--accent-primary);
  letter-spacing: 1px;
  text-align: center;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid var(--border-color);
  padding-top: 16px;
  margin-top: 4px;
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
  box-shadow: 0 4px 15px rgba(0, 210, 255, 0.25);
}

.btn-submit:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(0, 210, 255, 0.4);
}
</style>
