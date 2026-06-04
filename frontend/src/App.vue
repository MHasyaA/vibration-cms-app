<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import MetricCard from './components/MetricCard.vue';
import ScadaMotorSvg from './components/ScadaMotorSvg.vue';
import TrendLineChart from './components/TrendLineChart.vue';
import DeviceModal from './components/DeviceModal.vue';
import ModbusConfigModal from './components/ModbusConfigModal.vue';
import ModbusRegisterModal from './components/ModbusRegisterModal.vue';
import darkLogo from './assets/dark_logo.png';
import lightLogo from './assets/light_logo.png';
import { 
  DUMMY_DEVICES, 
  generateDummyTelemetries, 
  DUMMY_ALARMS_ACTIVE, 
  DUMMY_ALARMS_HISTORY, 
  DUMMY_ANALYTICS_SUMMARY, 
  generateDummyTrend,
  DUMMY_MODBUS_CONNECTIONS
} from './utils/dummyData';

// --- State Router ---
const activePage = ref<'login' | 'overview' | 'detail' | 'alarms' | 'devices' | 'modbus-config' | 'master-setting'>('login');
const isDummyMode = ref(localStorage.getItem('scada_dummy_mode') === 'true');

// --- Auth State ---
const username = ref(localStorage.getItem('scada_username') || '');
const password = ref(localStorage.getItem('scada_password') || '');
const userRole = ref(localStorage.getItem('scada_role') || '');
const isLoggedIn = ref(!!localStorage.getItem('scada_logged_in'));
const loginError = ref<string | null>(null);
const loginLoading = ref(false);

// --- SCADA Telemetry & Config State ---
const devicesList = ref<any[]>([]);
const realtimeData = ref<any[]>([]);
const activeAlarms = ref<any[]>([]);
const alarmHistory = ref<any[]>([]);
const selectedDeviceId = ref<number | null>(null);
const historicalLogs = ref<any[]>([]);

// Analytics Summary Data
const totalDevicesCount = ref(0);
const activeAlarmsCount = ref(0);
const deviceStatsList = ref<any[]>([]);

// Advanced Analytics State
const healthScore = ref(100);
const isoCompliance = ref<any>({ compliant: 0, nonCompliant: 0, compliantPercentage: 100, zoneA: 0, zoneB: 0, zoneC: 0, zoneD: 0 });
const alarmTrend = computed(() => {
  const allAlarms = [...activeAlarms.value, ...alarmHistory.value];
  const history = [];
  const now = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().substring(0, 10);
    
    const count = allAlarms.filter((a: any) => {
      const aDate = new Date(a.timestamp).toISOString().substring(0, 10);
      return aDate === dateStr;
    }).length;
    
    history.push({ date: dateStr, count });
  }
  
  const currentTotal = history.reduce((sum, item) => sum + item.count, 0);
  
  const prevStart = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);
  const prevEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const previousTotal = allAlarms.filter((a: any) => {
    const aTime = new Date(a.timestamp).getTime();
    return aTime >= prevStart.getTime() && aTime < prevEnd.getTime();
  }).length;
  
  const percentage = previousTotal === 0 
    ? (currentTotal > 0 ? 100 : 0) 
    : Math.round(((currentTotal - previousTotal) / previousTotal) * 100);
    
  return { percentage, history };
});
const worstPerformers = ref<any[]>([]);
const timeToMaintenance = ref<any[]>([]);
const baseliningDeviations = ref<any[]>([]);

// Trend Filter State
const trendStart = ref<string | undefined>(undefined);
const trendEnd = ref<string | undefined>(undefined);

// --- Alarm Filter State ---
const alarmFilterDevice = ref<string>('all');
const alarmFilterParam = ref<string>('all');
const alarmFilterStartDate = ref<string>('');
const alarmFilterEndDate = ref<string>('');

// Computed properties for filtering alarms
const filteredActiveAlarms = computed(() => {
  return activeAlarms.value.filter(alarm => {
    if (alarmFilterDevice.value !== 'all') {
      const devName = alarm.deviceName || '';
      if (devName !== alarmFilterDevice.value) return false;
    }
    if (alarmFilterParam.value !== 'all') {
      const p = alarm.parameter || '';
      if (p.toLowerCase().replace(/\s+/g, '') !== alarmFilterParam.value.toLowerCase().replace(/\s+/g, '')) return false;
    }
    if (alarmFilterStartDate.value) {
      const start = new Date(alarmFilterStartDate.value).getTime();
      const alarmTime = new Date(alarm.timestamp).getTime();
      if (alarmTime < start) return false;
    }
    if (alarmFilterEndDate.value) {
      const end = new Date(alarmFilterEndDate.value).getTime();
      const alarmTime = new Date(alarm.timestamp).getTime();
      if (alarmTime > end) return false;
    }
    return true;
  });
});

const filteredAlarmHistory = computed(() => {
  return alarmHistory.value.filter(alarm => {
    if (alarmFilterDevice.value !== 'all') {
      const devName = alarm.deviceName || '';
      if (devName !== alarmFilterDevice.value) return false;
    }
    if (alarmFilterParam.value !== 'all') {
      const p = alarm.parameter || '';
      if (p.toLowerCase().replace(/\s+/g, '') !== alarmFilterParam.value.toLowerCase().replace(/\s+/g, '')) return false;
    }
    if (alarmFilterStartDate.value) {
      const start = new Date(alarmFilterStartDate.value).getTime();
      const alarmTime = new Date(alarm.timestamp).getTime();
      if (alarmTime < start) return false;
    }
    if (alarmFilterEndDate.value) {
      const end = new Date(alarmFilterEndDate.value).getTime();
      const alarmTime = new Date(alarm.timestamp).getTime();
      if (alarmTime > end) return false;
    }
    return true;
  });
});

// --- Modals State ---
const showDeviceModal = ref(false);
const selectedDeviceForEdit = ref<any | null>(null);

// --- Modbus Config State ---
const modbusConnections = ref<any[]>([]);
const showModbusModal = ref(false);
const selectedConnectionForEdit = ref<any | null>(null);
const showRegisterModal = ref(false);
const selectedDeviceForRegister = ref<any | null>(null);
const modbusTestResult = ref<Record<number, { loading: boolean; message: string; ok: boolean }>>({});

// --- Settings State ---
const systemSettings = ref<Record<string, string>>({
  bobotWarningAlarm: "5",
  bobotCriticalAlarm: "15",
  ambangKapasitasSistem: "5000000",
  pilihanKelasMesin: "Class I",
  batasBawahZoneB: "1.12",
  batasBawahZoneC: "2.80",
  batasBawahZoneD: "7.10",
  jendelaWaktuBaseline: "7",
  toleransiDeviasiMaksimal: "20",
  sensitivitasDeteksiAnomali: "Medium",
  dataPointsRegression: "14",
  thresholdKritisKegagalan: "7.10",
  batasPeringatanHari: "15",
  metrikPengurutan: "alarmFrequency",
  rentangWaktuEvaluasi: "168",
});
const isSavingSettings = ref(false);
const saveSettingsStatus = ref<'idle' | 'saving' | 'success' | 'error'>('idle');
const activeSettingsTab = ref<'general' | 'iso' | 'baseline' | 'predictive' | 'sorting'>('general');

async function fetchSystemSettings() {
  if (isDummyMode.value) {
    const cached = localStorage.getItem('scada_system_settings');
    if (cached) {
      try {
        systemSettings.value = { ...systemSettings.value, ...JSON.parse(cached) };
      } catch (e) {
        console.error('Failed to parse cached settings, using defaults');
      }
    } else {
      localStorage.setItem('scada_system_settings', JSON.stringify(systemSettings.value));
    }
    return;
  }
  
  try {
    const res = await fetch('/api/settings', { headers: getHeaders() });
    const result = await res.json();
    if (result.success) {
      systemSettings.value = result.data;
    }
  } catch (err) {
    console.error('Failed to fetch system settings from API:', err);
  }
}

async function saveSystemSettings() {
  isSavingSettings.value = true;
  saveSettingsStatus.value = 'saving';
  
  try {
    if (isDummyMode.value) {
      localStorage.setItem('scada_system_settings', JSON.stringify(systemSettings.value));
      // Re-trigger dummy analytics loading
      await loadAllData();
      saveSettingsStatus.value = 'success';
      setTimeout(() => { saveSettingsStatus.value = 'idle'; }, 3000);
      return;
    }
    
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(systemSettings.value)
    });
    const result = await res.json();
    if (result.success) {
      saveSettingsStatus.value = 'success';
      await loadAllData(); // Refresh analytics with new settings applied
      setTimeout(() => { saveSettingsStatus.value = 'idle'; }, 3000);
    } else {
      saveSettingsStatus.value = 'error';
      alert(`Gagal menyimpan pengaturan: ${result.message}`);
    }
  } catch (err) {
    saveSettingsStatus.value = 'error';
    alert('Terjadi kesalahan koneksi saat menyimpan pengaturan');
  } finally {
    isSavingSettings.value = false;
  }
}

const defaultZoneBLimit = computed(() => {
  const c = systemSettings.value.pilihanKelasMesin;
  if (c === 'Class II') return '1.80';
  if (c === 'Class III') return '2.80';
  if (c === 'Class IV') return '4.50';
  return '1.12';
});

const defaultZoneCLimit = computed(() => {
  const c = systemSettings.value.pilihanKelasMesin;
  if (c === 'Class II') return '4.50';
  if (c === 'Class III') return '7.10';
  if (c === 'Class IV') return '11.20';
  return '2.80';
});

const defaultZoneDLimit = computed(() => {
  const c = systemSettings.value.pilihanKelasMesin;
  if (c === 'Class II') return '11.20';
  if (c === 'Class III') return '18.00';
  if (c === 'Class IV') return '28.00';
  return '7.10';
});

function onMachineClassChange() {
  const newClass = systemSettings.value.pilihanKelasMesin;
  if (newClass === 'Class I') {
    systemSettings.value.batasBawahZoneB = '1.12';
    systemSettings.value.batasBawahZoneC = '2.80';
    systemSettings.value.batasBawahZoneD = '7.10';
  } else if (newClass === 'Class II') {
    systemSettings.value.batasBawahZoneB = '1.80';
    systemSettings.value.batasBawahZoneC = '4.50';
    systemSettings.value.batasBawahZoneD = '11.20';
  } else if (newClass === 'Class III') {
    systemSettings.value.batasBawahZoneB = '2.80';
    systemSettings.value.batasBawahZoneC = '7.10';
    systemSettings.value.batasBawahZoneD = '18.00';
  } else if (newClass === 'Class IV') {
    systemSettings.value.batasBawahZoneB = '4.50';
    systemSettings.value.batasBawahZoneC = '11.20';
    systemSettings.value.batasBawahZoneD = '28.00';
  }
}

// --- Polling Interval ---
let pollInterval: any = null;

// --- Helper: Basic Auth Headers ---
function getHeaders() {
  const token = btoa(`${username.value}:${password.value}`);
  return {
    'Authorization': `Basic ${token}`,
    'Content-Type': 'application/json'
  };
}

// --- Watchers ---
watch(isDummyMode, async () => {
  await loadAllData();
});

// --- Functions: Auth ---
async function handleLogin() {
  if (!username.value || !password.value) {
    loginError.value = 'Silakan isi username dan password';
    return;
  }
  
  loginLoading.value = true;
  loginError.value = null;
  
  try {
    let isValidDummy = false;
    if ((username.value === 'admin' && password.value === 'adminpassword') || 
        (username.value === 'user' && password.value === 'userpassword')) {
       isValidDummy = true;
    }

    if (isDummyMode.value) {
       if (!isValidDummy) throw new Error('Kredensial salah. Gunakan admin/adminpassword atau user/userpassword');
       await new Promise(r => setTimeout(r, 600)); // Simulate delay
    } else {
      // Attempt authentication by fetching devices list
      const token = btoa(`${username.value}:${password.value}`);
      try {
        const res = await fetch('/api/devices', {
          headers: { 'Authorization': `Basic ${token}` }
        });
        
        if (!res.ok) {
          if (res.status === 401) {
            throw new Error('Kredensial salah. Gunakan admin/adminpassword atau user/userpassword');
          }
          // Auto fallback if backend missing
          if (isValidDummy) {
            isDummyMode.value = true;
          } else {
            throw new Error(`Koneksi Backend Gagal (${res.status}). Gunakan mode demo.`);
          }
        }
      } catch (e: any) {
        if (e.message.includes('Kredensial')) throw e;
        if (isValidDummy) {
          isDummyMode.value = true;
        } else {
          throw new Error('Koneksi Backend Gagal. Centang Mode Demo & gunakan kredensial Pengujian.');
        }
      }
    }
    
    // Determine role
    const role = username.value === 'admin' ? 'admin' : 'user';
    
    localStorage.setItem('scada_username', username.value);
    localStorage.setItem('scada_password', password.value);
    localStorage.setItem('scada_role', role);
    localStorage.setItem('scada_logged_in', 'true');
    if (isDummyMode.value) localStorage.setItem('scada_dummy_mode', 'true');
    else localStorage.removeItem('scada_dummy_mode');
    
    userRole.value = role;
    isLoggedIn.value = true;
    loginError.value = null;
    activePage.value = 'overview';
    
    // Load initial application data
    await loadAllData();
    startPolling();
  } catch (err: any) {
    loginError.value = err.message || 'Terjadi kesalahan sistem.';
  } finally {
    loginLoading.value = false;
  }
}

function handleLogout() {
  localStorage.clear();
  username.value = '';
  password.value = '';
  userRole.value = '';
  isLoggedIn.value = false;
  isDummyMode.value = false;
  activePage.value = 'login';
  stopPolling();
}

// --- Functions: API Integrations ---
async function loadAllData() {
  if (!isLoggedIn.value) return;
  
  try {
    await fetchSystemSettings(); // Fetch settings first so that calculations use correct variables!
    await Promise.all([
      fetchDevices(),
      fetchRealtimeTelemetries(),
      fetchAlarms(),
      fetchAnalyticsSummary(),
      fetchModbusConnections()
    ]);
    
    // Set first device as default selected in detail view if none selected
    if (selectedDeviceId.value === null && devicesList.value.length > 0) {
      selectedDeviceId.value = devicesList.value[0].id;
      await fetchHistoricalTrend(selectedDeviceId.value!);
    }
  } catch (err) {
    console.error('Failed to load application data:', err);
  }
}

async function fetchDevices() {
  if (isDummyMode.value) {
    devicesList.value = DUMMY_DEVICES;
    return;
  }
  const res = await fetch('/api/devices', { headers: getHeaders() });
  if (res.status === 401) handleLogout();
  const result = await res.json();
  if (result.success) {
    devicesList.value = result.data;
  }
}

async function fetchRealtimeTelemetries() {
  if (isDummyMode.value) {
    realtimeData.value = generateDummyTelemetries();
    return;
  }
  const res = await fetch('/api/data/realtime', { headers: getHeaders() });
  const result = await res.json();
  if (result.success) {
    realtimeData.value = result.data;
  }
}

async function fetchAlarms() {
  if (isDummyMode.value) {
    activeAlarms.value = DUMMY_ALARMS_ACTIVE;
    alarmHistory.value = DUMMY_ALARMS_HISTORY;
    return;
  }
  const [activeRes, historyRes] = await Promise.all([
    fetch('/api/alarms?status=active', { headers: getHeaders() }),
    fetch('/api/alarms?status=acknowledged', { headers: getHeaders() })
  ]);
  
  const activeResult = await activeRes.json();
  const historyResult = await historyRes.json();
  
  if (activeResult.success) activeAlarms.value = activeResult.data;
  if (historyResult.success) alarmHistory.value = historyResult.data;
}

async function fetchAnalyticsSummary() {
  if (isDummyMode.value) {
    const bobotWarningAlarm = parseFloat(systemSettings.value.bobotWarningAlarm || "5");
    const bobotCriticalAlarm = parseFloat(systemSettings.value.bobotCriticalAlarm || "15");
    const choicesISO = systemSettings.value.pilihanKelasMesin || "Class I";
    const batasBawahZoneB = parseFloat(systemSettings.value.batasBawahZoneB || "1.12");
    const batasBawahZoneC = parseFloat(systemSettings.value.batasBawahZoneC || "2.80");
    const batasBawahZoneD = parseFloat(systemSettings.value.batasBawahZoneD || "7.10");
    const jendelaWaktuBaseline = parseInt(systemSettings.value.jendelaWaktuBaseline || "7", 10);
    const toleransiDeviasiMaksimal = parseFloat(systemSettings.value.toleransiDeviasiMaksimal || "20");
    const sensitivitasDeteksiAnomali = systemSettings.value.sensitivitasDeteksiAnomali || "Medium";
    const dataPointsRegression = parseInt(systemSettings.value.dataPointsRegression || "14", 10);
    const thresholdKritisKegagalan = parseFloat(systemSettings.value.thresholdKritisKegagalan || "7.10");
    const batasPeringatanHari = parseInt(systemSettings.value.batasPeringatanHari || "15", 10);
    const metrikPengurutan = systemSettings.value.metrikPengurutan || "alarmFrequency";
    const rentangWaktuEvaluasi = parseInt(systemSettings.value.rentangWaktuEvaluasi || "168", 10);

    // Read variables to satisfy TypeScript compiler
    console.debug('[Demo Settings]', { choicesISO, jendelaWaktuBaseline, toleransiDeviasiMaksimal, dataPointsRegression, rentangWaktuEvaluasi });

    totalDevicesCount.value = devicesList.value.length;
    activeAlarmsCount.value = activeAlarms.value.length;
    
    // 1. Health Score Calculation
    let warningCount = 0;
    let criticalCount = 0;
    const deviceStats = [];
    
    for (const d of devicesList.value) {
      const status = getDeviceStatus(d.id);
      if (status === 'critical') criticalCount++;
      else if (status === 'warning') warningCount++;
      
      deviceStats.push({
        deviceId: d.id,
        namaSensor: d.namaSensor,
        lokasi: d.lokasi,
        status: status
      });
    }
    
    let hs = 100 - (warningCount * bobotWarningAlarm) - (criticalCount * bobotCriticalAlarm);
    healthScore.value = Math.max(0, Math.round(hs));
    deviceStatsList.value = deviceStats;

    // 2. ISO Compliance Classification
    const complianceDetails = { zoneA: 0, zoneB: 0, zoneC: 0, zoneD: 0 };
    for (const d of devicesList.value) {
      const tel = getDeviceTelemetry(d.id);
      if (tel) {
        const maxVel = Math.max(tel.zVelocity || 0, tel.xVelocity || 0);
        if (maxVel < batasBawahZoneB) complianceDetails.zoneA++;
        else if (maxVel < batasBawahZoneC) complianceDetails.zoneB++;
        else if (maxVel < batasBawahZoneD) complianceDetails.zoneC++;
        else complianceDetails.zoneD++;
      } else {
        complianceDetails.zoneA++;
      }
    }
    const compliantCount = complianceDetails.zoneA + complianceDetails.zoneB;
    isoCompliance.value = {
      compliant: compliantCount,
      nonCompliant: devicesList.value.length - compliantCount,
      compliantPercentage: devicesList.value.length > 0 ? Math.round((compliantCount / devicesList.value.length) * 100) : 100,
      ...complianceDetails
    };

    // 3. Alarm Trend is computed dynamically from active and historical alarms

    // 4. Worst Performers List Sorting
    const worstPerformersList = [];
    for (const d of devicesList.value) {
      const tel = getDeviceTelemetry(d.id);
      if (!tel) continue;
      
      const limits = {
        temperature: d.setpointTemp || 70,
        zVelocity: d.setpointZVel || 7.1,
        xVelocity: d.setpointXVel || 7.1,
        zAcceleration: d.setpointZAcc || 10,
        xAcceleration: d.setpointXAcc || 10
      };
      
      const readings = {
        temperature: tel.temperature || 0,
        zVelocity: tel.zVelocity || 0,
        xVelocity: tel.xVelocity || 0,
        zAcceleration: tel.zAcceleration || 0,
        xAcceleration: tel.xAcceleration || 0
      };
      
      let maxRatio = 0;
      let worstParam = "";
      let worstVal = 0;
      let worstLimit = 0;
      
      for (const [key, value] of Object.entries(readings)) {
        const limit = (limits as any)[key];
        if (limit > 0) {
          const ratio = (value / limit) * 100;
          if (ratio > maxRatio) {
            maxRatio = ratio;
            worstParam = key;
            worstVal = value;
            worstLimit = limit;
          }
        }
      }
      
      let sortingScore = 0;
      if (metrikPengurutan === 'alarmFrequency') {
        sortingScore = activeAlarms.value.filter((a: any) => a.deviceId === d.id).length;
      } else if (metrikPengurutan === 'baselineDeviation') {
        const baselineRow = DUMMY_ANALYTICS_SUMMARY.baseliningDeviations.find((b: any) => b.deviceId === d.id);
        sortingScore = baselineRow ? Math.abs(baselineRow.deviation) : 0;
      } else {
        sortingScore = maxRatio;
      }
      
      if (maxRatio >= 50) {
        worstPerformersList.push({
          deviceId: d.id,
          deviceName: d.namaSensor,
          parameter: worstParam,
          value: parseFloat(worstVal.toFixed(2)),
          limit: parseFloat(worstLimit.toFixed(2)),
          ratio: parseFloat(maxRatio.toFixed(1)),
          sortingScore: sortingScore
        });
      }
    }
    
    worstPerformersList.sort((a, b) => b.sortingScore - a.sortingScore);
    worstPerformers.value = worstPerformersList.slice(0, 3);

    // 5. Linear Regression (Estimasi Hari)
    const ttm = [];
    const baseTtm = [
      { deviceId: 3, parameter: 'zVelocity', slope: 0.450 },
      { deviceId: 5, parameter: 'xVelocity', slope: 0.120 },
      { deviceId: 2, parameter: 'temperature', slope: 0.320 }
    ];
    
    for (const b of baseTtm) {
      const dev = devicesList.value.find((d: any) => d.id === b.deviceId);
      if (!dev) continue;
      const tel = getDeviceTelemetry(b.deviceId);
      if (!tel) continue;
      const val = tel[b.parameter as keyof typeof tel] || 0;
      const limit = b.parameter.toLowerCase().includes('velocity') ? thresholdKritisKegagalan : (dev as any)[`setpoint${b.parameter.charAt(0).toUpperCase() + b.parameter.slice(1)}`] || 70;
      
      const days = (limit - val) / b.slope;
      if (days >= 0 && days <= 120) {
        ttm.push({
          deviceId: b.deviceId,
          deviceName: dev.namaSensor,
          parameter: b.parameter,
          estimatedDays: Math.round(days),
          slope: b.slope,
          isCriticalWarning: Math.round(days) < batasPeringatanHari
        });
      }
    }
    ttm.sort((a, b) => a.estimatedDays - b.estimatedDays);
    timeToMaintenance.value = ttm;

    // 6. Baselining Deviations Z-Score threshold mapping
    let zThreshold = 3.0;
    if (sensitivitasDeteksiAnomali === 'Low') zThreshold = 4.0;
    else if (sensitivitasDeteksiAnomali === 'High') zThreshold = 2.0;
    
    baseliningDeviations.value = DUMMY_ANALYTICS_SUMMARY.baseliningDeviations.map((item: any) => ({
      ...item,
      isAnomaly: Math.abs(item.deviation) >= zThreshold
    }));

    return;
  }
  const res = await fetch('/api/analytics/summary', { headers: getHeaders() });
  const result = await res.json();
  if (result.success) {
    totalDevicesCount.value = result.data.totalDevices;
    activeAlarmsCount.value = result.data.totalActiveAlarms;
    deviceStatsList.value = result.data.deviceStats;
    healthScore.value = result.data.healthScore ?? 100;
    isoCompliance.value = result.data.isoCompliance ?? { compliant: 0, nonCompliant: 0, compliantPercentage: 100, zoneA: 0, zoneB: 0, zoneC: 0, zoneD: 0 };
    // alarmTrend is computed dynamically on the frontend
    worstPerformers.value = result.data.worstPerformers ?? [];
    timeToMaintenance.value = result.data.timeToMaintenance ?? [];
    baseliningDeviations.value = result.data.baseliningDeviations ?? [];
  }
}

async function fetchHistoricalTrend(deviceId: number) {
  if (isDummyMode.value) {
    historicalLogs.value = generateDummyTrend(deviceId, trendStart.value, trendEnd.value);
    return;
  }
  
  let url = `/api/data/trend?deviceId=${deviceId}`;
  if (trendStart.value) url += `&start=${trendStart.value}`;
  if (trendEnd.value) url += `&end=${trendEnd.value}`;
  
  const res = await fetch(url, { headers: getHeaders() });
  const result = await res.json();
  if (result.success) {
    historicalLogs.value = result.data;
  }
}

function handleRangeChange(payload: { start?: string; end?: string }) {
  trendStart.value = payload.start;
  trendEnd.value = payload.end;
  if (selectedDeviceId.value !== null) {
    fetchHistoricalTrend(selectedDeviceId.value);
  }
}

// --- Alarm Actions ---
async function acknowledgeAlarm(alarmId: number) {
  // Dummy mode: handle locally without API
  if (isDummyMode.value) {
    const alarm = activeAlarms.value.find((a: any) => a.id === alarmId);
    if (alarm) {
      activeAlarms.value = activeAlarms.value.filter((a: any) => a.id !== alarmId);
      alarmHistory.value = [{ ...alarm, status: 'acknowledged' }, ...alarmHistory.value];
      activeAlarmsCount.value = activeAlarms.value.length;
    }
    return;
  }
  try {
    const res = await fetch(`/api/alarms/${alarmId}/acknowledge`, {
      method: 'PUT',
      headers: getHeaders()
    });
    const result = await res.json();
    if (result.success) {
      await loadAllData();
      if (selectedDeviceId.value !== null) {
        await fetchHistoricalTrend(selectedDeviceId.value);
      }
    }
  } catch (err) {
    console.error('Failed to acknowledge alarm:', err);
  }
}

// --- CRUD Device Actions ---
async function handleSaveDevice(payload: any) {
  // Dummy mode: simulate CRUD in local state
  if (isDummyMode.value) {
    if (selectedDeviceForEdit.value) {
      // UPDATE
      const idx = devicesList.value.findIndex((d: any) => d.id === selectedDeviceForEdit.value.id);
      if (idx !== -1) devicesList.value[idx] = { ...devicesList.value[idx], ...payload };
    } else {
      // CREATE
      const newId = Math.max(...devicesList.value.map((d: any) => d.id)) + 1;
      devicesList.value = [...devicesList.value, { id: newId, slaveId: newId + 100, ...payload }];
    }
    showDeviceModal.value = false;
    selectedDeviceForEdit.value = null;
    return;
  }
  try {
    let url = '/api/devices';
    let method = 'POST';
    
    if (selectedDeviceForEdit.value) {
      url = `/api/devices/${selectedDeviceForEdit.value.id}`;
      method = 'PUT';
    }
    
    const res = await fetch(url, {
      method,
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    
    const result = await res.json();
    if (result.success) {
      showDeviceModal.value = false;
      selectedDeviceForEdit.value = null;
      await loadAllData();
    } else {
      alert(`Gagal menyimpan perangkat: ${result.message}`);
    }
  } catch (err) {
    console.error('Error saving device:', err);
    alert('Terjadi kesalahan koneksi saat menyimpan perangkat');
  }
}

async function handleDeleteDevice(deviceId: number) {
  if (!confirm('Apakah Anda yakin ingin menghapus perangkat sensor ini? Semua log data historis dan alarm terkait juga akan terhapus.')) return;
  
  // Dummy mode: simulate delete in local state
  if (isDummyMode.value) {
    devicesList.value = devicesList.value.filter((d: any) => d.id !== deviceId);
    if (selectedDeviceId.value === deviceId) {
      selectedDeviceId.value = devicesList.value[0]?.id ?? null;
    }
    return;
  }
  try {
    const res = await fetch(`/api/devices/${deviceId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const result = await res.json();
    if (result.success) {
      if (selectedDeviceId.value === deviceId) {
        selectedDeviceId.value = null;
      }
      await loadAllData();
    } else {
      alert(`Gagal menghapus: ${result.message}`);
    }
  } catch (err) {
    console.error('Error deleting device:', err);
  }
}

function openAddDeviceModal() {
  selectedDeviceForEdit.value = null;
  showDeviceModal.value = true;
}

function openEditDeviceModal(device: any) {
  selectedDeviceForEdit.value = device;
  showDeviceModal.value = true;
}

// --- Dynamic Telemetry Helpers ---
const compliancePercentA = computed(() => {
  const tot = totalDevicesCount.value;
  return tot > 0 ? (isoCompliance.value.zoneA / tot) * 100 : 100;
});
const compliancePercentB = computed(() => {
  const tot = totalDevicesCount.value;
  return tot > 0 ? (isoCompliance.value.zoneB / tot) * 100 : 0;
});
const compliancePercentC = computed(() => {
  const tot = totalDevicesCount.value;
  return tot > 0 ? (isoCompliance.value.zoneC / tot) * 100 : 0;
});


const selectedDeviceDetails = computed(() => {
  if (selectedDeviceId.value === null) return null;
  return devicesList.value.find(d => d.id === selectedDeviceId.value) || null;
});

const selectedDeviceTelemetry = computed(() => {
  if (selectedDeviceId.value === null) return null;
  return realtimeData.value.find(d => d.deviceId === selectedDeviceId.value) || null;
});

function getDeviceTelemetry(deviceId: number) {
  return realtimeData.value.find(d => d.deviceId === deviceId) || null;
}

function getDeviceStatus(deviceId: number) {
  const tel = getDeviceTelemetry(deviceId);
  const dev = devicesList.value.find(d => d.id === deviceId);
  
  if (!tel || !dev || tel.temperature === null || tel.zVelocity === null) return 'unknown';
  
  const tempLimit = dev.setpointTemp || 70;
  const zVelLimit = dev.setpointZVel || 7.1;
  const xVelLimit = dev.setpointXVel || 7.1;
  
  const t = tel.temperature || 0;
  const zv = tel.zVelocity || 0;
  const xv = tel.xVelocity || 0;
  
  if (t >= tempLimit || zv >= zVelLimit || xv >= xVelLimit) return 'critical';
  if (t >= tempLimit * 0.8 || zv >= zVelLimit * 0.7 || xv >= xVelLimit * 0.7) return 'warning';
  return 'safe';
}

function isDeviceOnline(device: any): boolean {
  if (!device || !device.connectionId) return false;
  const connections = isDummyMode.value ? DUMMY_MODBUS_CONNECTIONS : modbusConnections.value;
  const conn = connections.find((c: any) => c.id === device.connectionId);
  return conn ? conn.isOnline : false;
}

function getTrendBarHeight(dayCount: any) {
  const history = alarmTrend.value?.history || [];
  const counts = history.map((h: any) => Number(h.count || 0));
  const max = Math.max(...counts, 1);
  return Math.max((Number(dayCount || 0) / max) * 75, Number(dayCount || 0) > 0 ? 6 : 1);
}

function getHintValue(val: any, decimals = 1) {
  if (val === undefined || val === null || isNaN(Number(val))) return 'N/A';
  return Number(val).toFixed(decimals);
}

function getHintClass(val: any) {
  if (val === undefined || val === null || isNaN(Number(val))) return 'hint-null';
  if (Number(val) === 0) return 'hint-zero';
  return 'hint-ok';
}

function formatDate(isoString: string) {
  if (!isoString) return '--/--/----';
  const d = new Date(isoString);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatLastUpdate(isoString: string) {
  if (!isoString) return '--/--/----';
  const d = new Date(isoString);
  // Tambah 7 jam khusus untuk data Last Update
  const wibDate = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return wibDate.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + wibDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

// --- Live Clock ---
const currentTime = ref('');
function updateClock() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  currentTime.value = `${dateStr} | ${timeStr}`;
}

// --- Modbus Connection Functions ---
async function fetchModbusConnections() {
  if (isDummyMode.value) {
    modbusConnections.value = DUMMY_MODBUS_CONNECTIONS;
    return;
  }
  try {
    const res = await fetch('/api/modbus/connections', { headers: getHeaders() });
    const result = await res.json();
    if (result.success) modbusConnections.value = result.data;
  } catch { /* silently fail */ }
}

async function saveModbusConnection(payload: any) {
  try {
    let url = '/api/modbus/connections';
    let method = 'POST';
    if (selectedConnectionForEdit.value) {
      url = `/api/modbus/connections/${selectedConnectionForEdit.value.id}`;
      method = 'PUT';
    }
    const res = await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(payload) });
    const result = await res.json();
    if (result.success) {
      showModbusModal.value = false;
      selectedConnectionForEdit.value = null;
      await fetchModbusConnections();
    } else {
      alert(`Gagal menyimpan: ${result.message}`);
    }
  } catch (err) {
    alert('Terjadi kesalahan koneksi');
  }
}

async function deleteModbusConnection(connId: number) {
  if (!confirm('Hapus koneksi ini? Device yang terhubung akan ter-disconnect dari koneksi ini.')) return;
  try {
    const res = await fetch(`/api/modbus/connections/${connId}`, { method: 'DELETE', headers: getHeaders() });
    const result = await res.json();
    if (result.success) {
      await fetchModbusConnections();
      await fetchDevices(); // Refresh devices since connectionId may have changed
    } else {
      alert(`Gagal menghapus: ${result.message}`);
    }
  } catch { alert('Terjadi kesalahan koneksi'); }
}

async function testModbusConnection(connId: number) {
  modbusTestResult.value[connId] = { loading: true, message: '', ok: false };
  try {
    const res = await fetch(`/api/modbus/connections/${connId}/test`, { headers: getHeaders() });
    const result = await res.json();
    modbusTestResult.value[connId] = {
      loading: false,
      message: result.message,
      ok: result.success,
    };
  } catch {
    modbusTestResult.value[connId] = { loading: false, message: 'Koneksi ke backend gagal', ok: false };
  }
}

async function saveDeviceModbusConfig(payload: any) {
  if (!selectedDeviceForRegister.value) return;
  if (isDummyMode.value) {
    const idx = devicesList.value.findIndex((d: any) => d.id === selectedDeviceForRegister.value.id);
    if (idx !== -1) {
      devicesList.value[idx] = { ...devicesList.value[idx], ...payload };
    }
    showRegisterModal.value = false;
    selectedDeviceForRegister.value = null;
    return;
  }
  try {
    const res = await fetch(`/api/devices/${selectedDeviceForRegister.value.id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      showRegisterModal.value = false;
      selectedDeviceForRegister.value = null;
      await fetchDevices();
    } else {
      alert(`Gagal menyimpan: ${result.message}`);
    }
  } catch { alert('Terjadi kesalahan koneksi'); }
}

function getConnectionName(connectionId: number | null): string {
  if (!connectionId) return '—';
  const conn = modbusConnections.value.find((c: any) => c.id === connectionId);
  return conn ? `${conn.ipAddress}:${conn.tcpPort}` : '—';
}

// --- Polling Lifecycle ---
function startPolling() {
  stopPolling();
  updateClock();
  pollInterval = setInterval(async () => {
    updateClock();
    await fetchRealtimeTelemetries();
    await fetchAlarms();
    await fetchAnalyticsSummary();
    await fetchModbusConnections();
    if (selectedDeviceId.value !== null && activePage.value === 'detail') {
      await fetchHistoricalTrend(selectedDeviceId.value);
    }
  }, 3000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// Handle Detail Sensor click from Sidebar/Overview
async function selectDevice(deviceId: number) {
  selectedDeviceId.value = deviceId;
  const wasAlreadyDetail = activePage.value === 'detail';
  activePage.value = 'detail';
  if (wasAlreadyDetail) {
    await fetchHistoricalTrend(deviceId);
  }
}

onMounted(async () => {
  updateClock();
  setInterval(updateClock, 1000);
  
  if (isLoggedIn.value) {
    activePage.value = 'overview';
    await loadAllData();
    startPolling();
  }
});

onUnmounted(() => {
  stopPolling();
});
</script>

<template>
  <!-- 1. LOGIN SCREEN -->
  <div v-if="activePage === 'login'" class="login-viewport">
    <div class="login-box glass-panel">
      <div class="logo-area">
        <img :src="lightLogo" class="company-logo-login" alt="Company Logo" />
        <h2>VIBRATION<span class="accent-text"> // CMS</span></h2>
      </div>
      <p class="login-sub">Condition Monitoring System - Industri 4.0</p>
      
      <div v-if="loginError" class="login-error">
        ⚠️ {{ loginError }}
      </div>
      
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="input-group">
          <label>Username</label>
          <input type="text" v-model="username" placeholder="Masukkan username (cth: admin)" required />
        </div>
        <div class="input-group">
          <label>Password</label>
          <input type="password" v-model="password" placeholder="Masukkan password (cth: adminpassword)" required />
        </div>
        
        <div class="input-group" style="flex-direction: row; align-items: center; gap: 10px; margin-top: 5px;">
          <input type="checkbox" id="demoMode" v-model="isDummyMode" style="width: auto; height: 16px; cursor: pointer;" />
          <label for="demoMode" style="font-size: 0.85rem; cursor: pointer; color: var(--text-secondary); margin-bottom: 0;">
            Gunakan Mode Demo (Tanpa Backend)
          </label>
        </div>
        <button type="submit" class="login-btn" :disabled="loginLoading">
          <span v-if="loginLoading">Menghubungkan...</span>
          <span v-else>LOG IN TO SYSTEM</span>
        </button>
      </form>
      
      <div class="login-hint">
        <p><strong>Tips Pengujian:</strong></p>
        <p>Admin: <code>admin</code> / <code>adminpassword</code></p>
        <p>User: <code>user</code> / <code>userpassword</code></p>
      </div>
    </div>
  </div>

  <!-- 2. SCADA MAIN VIEWPORT -->
  <div v-else class="scada-viewport">
    
    <!-- LEFT SIDEBAR -->
    <aside class="scada-sidebar">
      <div class="brand">
        <img :src="darkLogo" class="company-logo" alt="PT Logo" />
      </div>
      
      <nav class="nav-links">
        <button 
          @click="activePage = 'overview'" 
          class="nav-btn" 
          :class="{ active: activePage === 'overview' }"
        >
          <span class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg></span> Overview Dashboard
        </button>
        
        <button 
          @click="activePage = 'detail'" 
          class="nav-btn" 
          :class="{ active: activePage === 'detail' }"
        >
          <span class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></span> Detail Analisis
        </button>
        
        <button 
          @click="activePage = 'alarms'" 
          class="nav-btn" 
          :class="{ active: activePage === 'alarms' }"
        >
          <span class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg></span> Log Alarm 
          <span v-if="activeAlarms.length > 0" class="badge-count animate-pulse">
            {{ activeAlarms.length }}
          </span>
        </button>
        
        <button 
          @click="activePage = 'devices'" 
          class="nav-btn" 
          :class="{ active: activePage === 'devices' }"
        >
          <span class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg></span> Device Manager
        </button>

        <button
          v-if="userRole === 'admin'"
          @click="activePage = 'modbus-config'; fetchModbusConnections()"
          class="nav-btn"
          :class="{ active: activePage === 'modbus-config' }"
        >
          <span class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg></span> Modbus Config
        </button>

        <button
          v-if="userRole === 'admin'"
          @click="activePage = 'master-setting'; fetchSystemSettings()"
          class="nav-btn"
          :class="{ active: activePage === 'master-setting' }"
        >
          <span class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></span> Master Setting
        </button>
      </nav>
      
      <!-- Connected Devices Sublist -->
      <div class="sidebar-devices-sec">
        <h4>Telemetry List</h4>
        <div class="device-mini-list">
          <div 
            v-for="d in devicesList" 
            :key="d.id"
            @click="selectDevice(d.id)"
            class="mini-item"
            :class="{ 
              active: selectedDeviceId === d.id && activePage === 'detail', 
              'conn-ok': isDeviceOnline(d), 
              'conn-err': !isDeviceOnline(d) 
            }"
          >
            <span class="status-indicator"></span>
            <div class="meta">
              <span class="name">{{ d.namaSensor }}</span>
              <span class="loc">{{ d.lokasi }}</span>
            </div>
            <span class="mini-val text-mono" v-if="getDeviceTelemetry(d.id)">
              {{ (Math.max(getDeviceTelemetry(d.id)?.zVelocity || 0, getDeviceTelemetry(d.id)?.xVelocity || 0)).toFixed(1) }}
            </span>
          </div>
        </div>
      </div>
      
      <div class="sidebar-contact">
        <h4 class="contact-title">PT. SMARTEK SISTEM INOVASI</h4>
        <div class="contact-details">
          <p class="contact-item">
            <span class="contact-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
            </span>
            <span class="contact-text">+62 813 8585 8815</span>
          </p>
          <p class="contact-item">
            <span class="contact-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            </span>
            <span class="contact-text">arief@smartek-sistem.co.id</span>
          </p>
          <p class="contact-item">
            <span class="contact-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            </span>
            <span class="contact-text">Grand Wisata, Tambun, Bekasi</span>
          </p>
        </div>
      </div>

      <div class="user-block">
        <div class="user-info">
          <span class="role-badge" :class="userRole">{{ userRole.toUpperCase() }}</span>
          <span class="username">{{ username }}</span>
        </div>
        <button @click="handleLogout" class="btn-logout">LOGOUT</button>
      </div>
    </aside>

    <!-- RIGHT CONTAINER -->
    <div class="scada-content-container">
      
      <!-- TOP HEADER -->
      <header class="scada-header">
        <div class="header-left">
          <h2>{{ activePage.toUpperCase() }}</h2>
          <span class="server-status">
            <span class="green-dot animate-ping"></span> Live Polling OK (3s)
          </span>
        </div>

        <div class="header-center">
          <h1 class="system-main-title">Vibration Condition Monitoring Dashboard</h1>
        </div>

        <div class="header-right">
          <!-- Digital Clock -->
          <div class="clock-display text-mono">{{ currentTime }}</div>
          
          <!-- Dummy Mode Switcher -->
          <button @click="isDummyMode = !isDummyMode" class="theme-btn" :class="{ 'dummy-active': isDummyMode }">
            <span v-if="isDummyMode">
              <svg style="vertical-align: middle; margin-right: 4px;" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><path d="M10 8v8"></path><path d="M14 8v8"></path></svg> 
              DUMMY
            </span>
            <span v-else>
              <svg style="vertical-align: middle; margin-right: 4px;" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l-5.94 5.94"></path></svg> 
              LIVE
            </span>
          </button>
        </div>
      </header>

      <!-- DEMO MODE BANNER -->
      <div v-if="isDummyMode" class="demo-banner">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
        <span><strong>DEMO MODE AKTIF</strong> &mdash; Data simulasi, tidak terhubung ke perangkat nyata. Semua fitur dapat dieksplor secara penuh.</span>
      </div>

      <!-- MAIN SCROLLABLE CONTENT AREA -->
      <main class="scada-main-content">
        
        <!-- PAGE A: OVERVIEW DASHBOARD -->
        <section v-if="activePage === 'overview'" class="page-sec flex-col" style="gap: 0;">

          
          <!-- 5 Parameter Comparison Cards -->
          <div class="comparison-grid" style="order: 4; margin-top: 16px;">
            <div class="glass-panel comp-card">
              <h4>Velocity Z (mm/s)</h4>
              <div class="comp-list">
                <div v-for="d in devicesList" :key="'zvel-'+d.id" class="comp-bar-row">
                  <div class="comp-bar-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                    <span class="comp-lbl" style="margin-bottom: 0;">{{ d.namaSensor }}</span>
                    <span class="comp-val text-mono">{{ getDeviceTelemetry(d.id)?.zVelocity?.toFixed(2) || '--' }}</span>
                  </div>
                  <div class="comp-bar-track">
                     <div class="comp-bar-fill" :class="getDeviceStatus(d.id)" :style="{ width: Math.min(((getDeviceTelemetry(d.id)?.zVelocity || 0) / (d.setpointZVel || 10)) * 100, 100) + '%' }"></div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="glass-panel comp-card">
              <h4>Velocity X (mm/s)</h4>
              <div class="comp-list">
                <div v-for="d in devicesList" :key="'xvel-'+d.id" class="comp-bar-row">
                  <div class="comp-bar-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                    <span class="comp-lbl" style="margin-bottom: 0;">{{ d.namaSensor }}</span>
                    <span class="comp-val text-mono">{{ getDeviceTelemetry(d.id)?.xVelocity?.toFixed(2) || '--' }}</span>
                  </div>
                  <div class="comp-bar-track">
                     <div class="comp-bar-fill" :class="getDeviceStatus(d.id)" :style="{ width: Math.min(((getDeviceTelemetry(d.id)?.xVelocity || 0) / (d.setpointXVel || 10)) * 100, 100) + '%' }"></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="glass-panel comp-card">
              <h4>Acceleration Z (mm/s²)</h4>
              <div class="comp-list">
                <div v-for="d in devicesList" :key="'zacc-'+d.id" class="comp-bar-row">
                  <div class="comp-bar-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                    <span class="comp-lbl" style="margin-bottom: 0;">{{ d.namaSensor }}</span>
                    <span class="comp-val text-mono">{{ getDeviceTelemetry(d.id)?.zAcceleration?.toFixed(2) || '--' }}</span>
                  </div>
                  <div class="comp-bar-track">
                     <div class="comp-bar-fill" :class="getDeviceStatus(d.id)" :style="{ width: Math.min(((getDeviceTelemetry(d.id)?.zAcceleration || 0) / (d.setpointZAcc || 10)) * 100, 100) + '%' }"></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="glass-panel comp-card">
              <h4>Acceleration X (mm/s²)</h4>
              <div class="comp-list">
                <div v-for="d in devicesList" :key="'xacc-'+d.id" class="comp-bar-row">
                  <div class="comp-bar-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                    <span class="comp-lbl" style="margin-bottom: 0;">{{ d.namaSensor }}</span>
                    <span class="comp-val text-mono">{{ getDeviceTelemetry(d.id)?.xAcceleration?.toFixed(2) || '--' }}</span>
                  </div>
                  <div class="comp-bar-track">
                     <div class="comp-bar-fill" :class="getDeviceStatus(d.id)" :style="{ width: Math.min(((getDeviceTelemetry(d.id)?.xAcceleration || 0) / (d.setpointXAcc || 10)) * 100, 100) + '%' }"></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="glass-panel comp-card">
              <h4>Temperature (°C)</h4>
              <div class="comp-list">
                <div v-for="d in devicesList" :key="'temp-'+d.id" class="comp-bar-row">
                  <div class="comp-bar-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                    <span class="comp-lbl" style="margin-bottom: 0;">{{ d.namaSensor }}</span>
                    <span class="comp-val text-mono">{{ getDeviceTelemetry(d.id)?.temperature?.toFixed(1) || '--' }}</span>
                  </div>
                  <div class="comp-bar-track">
                     <div class="comp-bar-fill" :class="getDeviceStatus(d.id)" :style="{ width: Math.min(((getDeviceTelemetry(d.id)?.temperature || 0) / (d.setpointTemp || 70)) * 100, 100) + '%' }"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Grid of all devices overview cards -->
          <div class="devices-grid" style="order: 3; margin-top: 0;">
            <div 
              v-for="d in devicesList" 
              :key="d.id"
              class="glass-panel overview-device-card"
              :class="getDeviceStatus(d.id)"
            >
              <div class="card-header">
                <div>
                  <h3>{{ d.namaSensor }}</h3>
                  <span class="loc">{{ d.lokasi }}</span>
                </div>
                <div class="status-wrapper" style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
                  <span class="status-text">{{ getDeviceStatus(d.id).toUpperCase() }}</span>
                  <div class="last-update-hint" v-if="getDeviceStatus(d.id) === 'unknown' && getDeviceTelemetry(d.id)?.timestamp">
                    Last Update: {{ formatLastUpdate(getDeviceTelemetry(d.id).timestamp) }}
                  </div>
                </div>
              </div>
              
              <div class="telemetry-block" v-if="getDeviceTelemetry(d.id)">
                <div class="tel-col temp">
                  <span class="label">TEMP</span>
                  <span class="num text-mono">{{ getDeviceTelemetry(d.id).temperature?.toFixed(1) ?? '--' }} <span class="u">°C</span></span>
                </div>
                <div class="tel-col vibz">
                  <span class="label">VIB Z</span>
                  <span class="num text-mono">{{ getDeviceTelemetry(d.id).zVelocity?.toFixed(2) ?? '--' }} <span class="u">mm/s</span></span>
                </div>
                <div class="tel-col accz">
                  <span class="label">ACC Z</span>
                  <span class="num text-mono">{{ getDeviceTelemetry(d.id).zAcceleration?.toFixed(2) ?? '--' }} <span class="u">mm/s²</span></span>
                </div>
                <div class="tel-col vibx">
                  <span class="label">VIB X</span>
                  <span class="num text-mono">{{ getDeviceTelemetry(d.id).xVelocity?.toFixed(2) ?? '--' }} <span class="u">mm/s</span></span>
                </div>
                <div class="tel-col accx">
                  <span class="label">ACC X</span>
                  <span class="num text-mono">{{ getDeviceTelemetry(d.id).xAcceleration?.toFixed(2) ?? '--' }} <span class="u">mm/s²</span></span>
                </div>
              </div>
              <div class="telemetry-block empty-block" v-else>
                Belum ada data sensor terkirim
              </div>
              
              <div class="card-footer">
                <span class="slave-tag">Modbus ID: {{ d.slaveId }}</span>
                <button @click="selectDevice(d.id)" class="btn-detail">ANALISIS DETAIL ➔</button>
              </div>
            </div>
          </div>

          <!-- ADVANCED PERFORMANCE ANALYTICS SECTION -->
          <div class="advanced-analytics-container" style="order: 1; margin-top: 0; margin-bottom: 0; width: 100%;">
            <div class="analytics-grid">
              
              <!-- CARD 1: OVERALL SYSTEM HEALTH SCORE & TOTAL DEVICES -->
              <div class="glass-panel analytics-card health-card">
                <div class="card-title">KESEHATAN & KAPASITAS SISTEM</div>
                <div class="health-card-body">
                  <div class="health-gauge-section">
                    <svg width="145" height="145" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="44" stroke="rgba(9, 30, 66, 0.06)" stroke-width="9" fill="none" />
                      <circle cx="50" cy="50" r="44" 
                              :stroke="healthScore >= 85 ? 'var(--status-safe)' : (healthScore >= 70 ? 'var(--status-warning)' : 'var(--status-critical)')" 
                              stroke-width="9" 
                              fill="none" 
                              stroke-linecap="round" 
                              stroke-dasharray="276.46" 
                              :stroke-dashoffset="276.46 - (276.46 * healthScore) / 100"
                              style="transition: stroke-dashoffset 0.8s ease-in-out;" />
                      <text x="50" y="56" text-anchor="middle" font-size="18" font-weight="800" fill="var(--text-primary)" class="text-mono">{{ healthScore }}%</text>
                    </svg>
                  </div>
                  <div class="health-info-section">
                    <div class="health-status-badge" :class="healthScore >= 85 ? 'safe' : (healthScore >= 70 ? 'warning' : 'critical')">
                      {{ healthScore >= 85 ? 'SISTEM SEHAT' : (healthScore >= 70 ? 'PERLU PERHATIAN' : 'SISTEM KRITIS') }}
                    </div>
                    <div class="capacity-info">
                      <span class="capacity-label">KAPASITAS MONITORING</span>
                      <div class="capacity-count-display">
                        <span class="count-num text-mono">{{ totalDevicesCount }}</span>
                        <span class="count-unit">Perangkat Aktif</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- CARD 2: ISO 10816 COMPLIANCE STATUS -->
              <div class="glass-panel analytics-card iso-compliance-card">
                <div class="card-title">KEPATUHAN STANDAR ISO 10816</div>
                <div class="iso-donut-wrapper">
                  <div class="donut-chart" :style="{ background: `conic-gradient(#10b981 0% ${compliancePercentA}%, #06b6d4 ${compliancePercentA}% ${compliancePercentA + compliancePercentB}%, #f59e0b ${compliancePercentA + compliancePercentB}% ${compliancePercentA + compliancePercentB + compliancePercentC}%, #ef4444 ${compliancePercentA + compliancePercentB + compliancePercentC}% 100%)` }">
                    <div class="donut-hole">
                      <span class="pct text-mono">{{ isoCompliance.compliantPercentage }}%</span>
                      <span class="lbl">COMPLIANT</span>
                    </div>
                  </div>
                  <div class="iso-legend">
                    <div class="legend-item"><span class="color-dot zone-a"></span><span class="lbl"><strong>Kelas A</strong> (Sangat Baik): {{ isoCompliance.zoneA || 0 }}</span></div>
                    <div class="legend-item"><span class="color-dot zone-b"></span><span class="lbl"><strong>Kelas B</strong> (Normal): {{ isoCompliance.zoneB || 0 }}</span></div>
                    <div class="legend-item"><span class="color-dot zone-c"></span><span class="lbl"><strong>Kelas C</strong> (Waspada): {{ isoCompliance.zoneC || 0 }}</span></div>
                    <div class="legend-item"><span class="color-dot zone-d"></span><span class="lbl"><strong>Kelas D</strong> (Bahaya): {{ isoCompliance.zoneD || 0 }}</span></div>
                  </div>
                </div>
                <div class="iso-info-note">
                  Regulasi evaluasi tingkat keparahan getaran mesin (RMS Velocity mm/s). Kelas A/B = Aman, Kelas C = Warning, Kelas D = Kritis.
                  <div class="iso-regulation-hint" style="font-size: 0.58rem; color: var(--accent-cyan); margin-top: 3px; font-weight: 500;">
                    Digunakan untuk memantau kesehatan operasional dan mendeteksi dini indikasi kegagalan mekanikal (misal: misalignment, unbalance).
                  </div>
                </div>
              </div>

              <!-- CARD 3: SELF-BASELINING DEVIATION (ANOMALY) -->
              <div class="glass-panel analytics-card anomaly-card">
                <div class="card-title">DEVIAASI BASELINE & DETEKSI ANOMALI</div>
                <div class="anomaly-content" v-if="baseliningDeviations && baseliningDeviations.length > 0">
                  <div class="deviation-rows-scroll">
                    <div class="dev-row" v-for="(item, idx) in baseliningDeviations.slice(0, 3)" :key="'dev-'+idx">
                      <div class="dev-info">
                        <span class="name">{{ item.deviceName }}</span>
                        <span class="param text-mono">{{ item.parameter }}</span>
                      </div>
                      <div class="dev-badge-wrapper">
                        <span class="sigma-val text-mono" :class="{ 'critical-sig': Math.abs(item.deviation) >= 3 }">
                          {{ item.deviation > 0 ? '+' : '' }}{{ item.deviation }}σ
                        </span>
                        <span class="badge-anom flash-animation" v-if="item.isAnomaly">ANOMALI!</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="anomaly-empty text-mono" v-else>Tidak ada deviasi anomali terdeteksi</div>
              </div>

              <!-- CARD 4: TIME TO MAINTENANCE (LINEAR REGRESSION) -->
              <div class="glass-panel analytics-card regression-card">
                <div class="card-title">ESTIMASI WAKTU PEMELIHARAAN</div>
                <div class="regression-content" v-if="timeToMaintenance && timeToMaintenance.length > 0">
                  <div class="regression-badge-glow">
                    <span class="days text-mono">{{ timeToMaintenance[0].estimatedDays }} Hari</span>
                    <span class="lbl">Hingga Batas Kritis</span>
                  </div>
                  <div class="maintenance-hint text-mono">
                    Device: {{ timeToMaintenance[0].deviceName }} ({{ timeToMaintenance[0].parameter }})<br>
                    Degradasi: +{{ (timeToMaintenance[0].slope || 0).toFixed(3) }}/hari
                  </div>
                  <div class="sparkline-wrapper">
                    <svg width="100%" height="32" viewBox="0 0 200 32">
                      <path d="M 10 26 L 190 6" stroke="var(--status-critical)" stroke-width="2" stroke-dasharray="3" fill="none" />
                      <circle cx="10" cy="26" r="3" fill="var(--status-safe)" />
                      <circle cx="190" cy="6" r="4" fill="var(--status-critical)" />
                    </svg>
                  </div>
                </div>
                <div class="regression-empty text-mono" v-else>Tidak ada gejala degradasi (Sistem Stabil)</div>
              </div>

              <!-- CARD 5: STATUS MONITORING -->
              <div class="glass-panel analytics-card status-monitoring-card" :class="{ 'alert-mode': activeAlarms.length > 0 }">
                <div class="card-title">STATUS MONITORING</div>
                <div class="status-badge-wrapper">
                  <div v-if="activeAlarms.length > 0" class="status-neon-glow critical">
                    <span class="icon">⚠</span>
                    <span class="lbl">SISTEM ALERT</span>
                  </div>
                  <div v-else class="status-neon-glow safe">
                    <span class="icon">✓</span>
                    <span class="lbl">SISTEM NORMAL</span>
                  </div>
                </div>
                <div class="status-hint-desc text-mono">
                  {{ activeAlarms.length > 0 ? 'Segera periksa worst performer' : 'Seluruh parameter beroperasi wajar' }}
                </div>
              </div>

              <!-- CARD 6: ALARM AKTIF SAAT INI -->
              <div class="glass-panel analytics-card active-alarms-card" :class="{ 'alarm-active': activeAlarms.length > 0 }">
                <div class="card-title">ALARM AKTIF SAAT INI</div>
                <div class="alarm-val-wrapper">
                  <span class="count text-mono" :class="{ 'critical-text': activeAlarms.length > 0 }">{{ activeAlarms.length }}</span>
                  <span class="desc">Alarm Aktif Terdeteksi</span>
                </div>
                <div class="alarm-status-indicator">
                  <span v-if="activeAlarms.length > 0" class="badge-active-alarm pulse-soft-animation">⚠ ALERT AKTIF</span>
                  <span v-else class="badge-safe-alarm">✓ AMAN</span>
                </div>
              </div>

              <!-- CARD 7: TREN ALARM 7 HARI -->
              <div class="glass-panel analytics-card alarm-trend-card">
                <div class="card-header-flex">
                  <div class="card-title">TREN ALARM 7 HARI</div>
                  <div class="trend-badge" :class="alarmTrend.percentage <= 0 ? 'good' : 'bad'">
                    {{ alarmTrend.percentage <= 0 ? '' : '+' }}{{ alarmTrend.percentage }}%
                  </div>
                </div>
                <div class="trend-bars-wrapper" v-if="alarmTrend.history && alarmTrend.history.length > 0">
                  <svg class="trend-chart-svg" width="100%" height="130" viewBox="0 0 300 130">
                    <g v-for="(day, idx) in alarmTrend.history" :key="day.date">
                      <rect :x="8 + Number(idx) * 41" 
                            :y="110 - getTrendBarHeight(day.count)" 
                            width="28" 
                            :height="getTrendBarHeight(day.count)" 
                            rx="4" 
                            :fill="day.count > 0 ? 'var(--status-critical)' : 'rgba(9, 30, 66, 0.08)'" />
                      <text :x="22 + Number(idx) * 41" y="126" text-anchor="middle" font-size="10" fill="var(--text-secondary)">{{ day.date.substring(8, 10) }}</text>
                      <text :x="22 + Number(idx) * 41" :y="104 - getTrendBarHeight(day.count)" text-anchor="middle" font-size="10" font-weight="bold" fill="var(--text-primary)" v-if="day.count > 0">{{ day.count }}</text>
                    </g>
                  </svg>
                </div>
                <div class="trend-empty" v-else>Tidak ada data log alarm</div>
              </div>

              <!-- CARD 8: TOP 3 WORST PERFORMERS -->
              <div class="glass-panel analytics-card worst-performers-card">
                <div class="card-title">TOP 3 WORST PERFORMERS</div>
                <div class="worst-list" v-if="worstPerformers && worstPerformers.length > 0">
                  <div class="worst-row" v-for="(item, idx) in worstPerformers" :key="'worst-'+idx">
                    <div class="worst-info">
                      <span class="name">{{ item.deviceName }}</span>
                      <span class="param text-mono">{{ item.parameter }} ({{ item.value }}/{{ item.limit }})</span>
                    </div>
                    <div class="worst-progress-wrapper">
                      <div class="worst-progress-track">
                        <div class="worst-progress-fill" :style="{ width: Math.min(item.ratio, 100) + '%' }"></div>
                      </div>
                      <span class="ratio text-mono">{{ item.ratio }}%</span>
                    </div>
                  </div>
                </div>
                <div class="worst-empty text-mono" v-else>Semua perangkat beroperasi prima (Safe)</div>
              </div>

            </div>
          </div>
          <div class="scada-section-divider" style="order: 2; width: 100%;"></div>
        </section>

        <!-- PAGE B: DETAIL SENSOR VIEW -->
        <section v-else-if="activePage === 'detail'" class="page-sec">
          <div v-if="!selectedDeviceDetails" class="empty-state glass-panel">
            <span class="icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </span>
            <h3>Silakan pilih sensor pada menu sidebar untuk melakukan analisis detail</h3>
          </div>
          
          <div v-else class="detail-stack-layout">
            <!-- Top Section: Motor SVG & Analytics Cards -->
            <div class="detail-top-section">
              <div class="svg-wrapper">
                <ScadaMotorSvg 
                  :sensorName="selectedDeviceDetails.namaSensor"
                  :velocityZ="selectedDeviceTelemetry?.zVelocity"
                  :velocityX="selectedDeviceTelemetry?.xVelocity"
                  :temperature="selectedDeviceTelemetry?.temperature"
                  :setpointZ="selectedDeviceDetails.setpointZVel"
                  :setpointX="selectedDeviceDetails.setpointXVel"
                  :setpointTemp="selectedDeviceDetails.setpointTemp"
                />
              </div>
              
              <div class="detail-metrics-grid">
                <MetricCard 
                  title="Velocity Z"
                  :value="selectedDeviceTelemetry?.zVelocity"
                  unit="mm/s"
                  :setpoint="selectedDeviceDetails.setpointZVel"
                  icon="<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M2 12h4l3-9 5 18 3-9h5'/></svg>"
                />
                <MetricCard 
                  title="Velocity X"
                  :value="selectedDeviceTelemetry?.xVelocity"
                  unit="mm/s"
                  :setpoint="selectedDeviceDetails.setpointXVel"
                  icon="<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M2 12h4l3-9 5 18 3-9h5'/></svg>"
                />
                <MetricCard 
                  title="Accel Z"
                  :value="selectedDeviceTelemetry?.zAcceleration"
                  unit="mm/s²"
                  :setpoint="selectedDeviceDetails.setpointZAcc"
                  icon="<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2'/></svg>"
                />
                <MetricCard 
                  title="Accel X"
                  :value="selectedDeviceTelemetry?.xAcceleration"
                  unit="mm/s²"
                  :setpoint="selectedDeviceDetails.setpointXAcc"
                  icon="<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2'/></svg>"
                />
                <MetricCard 
                  title="Core Temp"
                  :value="selectedDeviceTelemetry?.temperature"
                  unit="°C"
                  :setpoint="selectedDeviceDetails.setpointTemp"
                  icon="<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z'/></svg>"
                  style="grid-column: span 2;"
                />
              </div>
            </div>
            
            <!-- Bottom Section: Historical Trend -->
            <div class="detail-bottom-section">
              <TrendLineChart 
                :logs="historicalLogs"
                :setpointTemp="selectedDeviceDetails.setpointTemp"
                :setpointZVel="selectedDeviceDetails.setpointZVel"
                :setpointXVel="selectedDeviceDetails.setpointXVel"
                :setpointZAcc="selectedDeviceDetails.setpointZAcc"
                :setpointXAcc="selectedDeviceDetails.setpointXAcc"
                :isDarkTheme="false"
                @range-change="handleRangeChange"
              />
            </div>
          </div>
        </section>

        <!-- PAGE C: LOG ALARM -->
        <section v-else-if="activePage === 'alarms'" class="page-sec flex-col">
          
          <!-- Modern Outlined Alarm Filter Panel -->
          <div class="glass-panel alarm-filter-panel" style="padding: 18px 24px; display: flex; flex-direction: column; gap: 14px; border-radius: var(--radius-lg); border: 1px solid var(--border-color); background: var(--bg-panel); margin-bottom: 8px;">
            <div class="filter-header" style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.8px;">
              Penyaringan Log Alarm (Real-time Filter)
            </div>
            <div class="filter-inputs" style="display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end;">
              <!-- 1. Objek Sensor Filter -->
              <div class="filter-group" style="display: flex; flex-direction: column; gap: 6px; flex: 1.2; min-width: 180px;">
                <label style="font-size: 0.7rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.3px;">Objek Sensor</label>
                <select v-model="alarmFilterDevice" style="background: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-primary); padding: 8px 12px; border-radius: var(--radius-md); font-size: 0.8rem; font-weight: 600; outline: none; width: 100%; transition: border-color 0.2s;">
                  <option value="all">Semua Sensor</option>
                  <option v-for="d in devicesList" :key="d.id" :value="d.namaSensor">{{ d.namaSensor }}</option>
                </select>
              </div>

              <!-- 2. Parameter Filter -->
              <div class="filter-group" style="display: flex; flex-direction: column; gap: 6px; flex: 1.2; min-width: 180px;">
                <label style="font-size: 0.7rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.3px;">Parameter</label>
                <select v-model="alarmFilterParam" style="background: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-primary); padding: 8px 12px; border-radius: var(--radius-md); font-size: 0.8rem; font-weight: 600; outline: none; width: 100%; transition: border-color 0.2s;">
                  <option value="all">Semua Parameter</option>
                  <option value="temperature">Temperature</option>
                  <option value="velocity z">Velocity Z</option>
                  <option value="velocity x">Velocity X</option>
                  <option value="acceleration z">Acceleration Z</option>
                  <option value="acceleration x">Acceleration X</option>
                </select>
              </div>

              <!-- 3. Mulai Tanggal -->
              <div class="filter-group" style="display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 150px;">
                <label style="font-size: 0.7rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.3px;">Dari Tanggal</label>
                <input type="date" v-model="alarmFilterStartDate" style="background: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-primary); padding: 7px 12px; border-radius: var(--radius-md); font-size: 0.8rem; outline: none; width: 100%;" />
              </div>

              <!-- 4. Selesai Tanggal -->
              <div class="filter-group" style="display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 150px;">
                <label style="font-size: 0.7rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.3px;">Sampai Tanggal</label>
                <input type="date" v-model="alarmFilterEndDate" style="background: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-primary); padding: 7px 12px; border-radius: var(--radius-md); font-size: 0.8rem; outline: none; width: 100%;" />
              </div>

              <!-- 5. Reset Button -->
              <button @click="alarmFilterDevice = 'all'; alarmFilterParam = 'all'; alarmFilterStartDate = ''; alarmFilterEndDate = '';" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-secondary); padding: 8px 16px; border-radius: var(--radius-md); font-size: 0.8rem; font-weight: 700; cursor: pointer; transition: all 0.2s; height: 36px; display: flex; align-items: center; justify-content: center; gap: 4px;" onmouseover="this.style.background='rgba(9,30,66,0.04)'; this.style.color='var(--text-primary)'" onmouseout="this.style.background='transparent'; this.style.color='var(--text-secondary)'">
                Reset
              </button>
            </div>
          </div>

          <div class="alarm-view-layout">
            <!-- Active Alarms Card -->
            <div class="glass-panel table-panel">
              <div class="panel-header">
                <h3>Alarm Aktif (Butuh Konfirmasi)</h3>
                <span class="alarm-badge critical" v-if="filteredActiveAlarms.length > 0">
                  {{ filteredActiveAlarms.length }} KRITIS
                </span>
              </div>
              
              <div class="table-wrapper">
                <table class="scada-table">
                  <thead>
                    <tr>
                      <th>Waktu Terdeteksi</th>
                      <th>Objek Sensor</th>
                      <th>Parameter</th>
                      <th>Nilai Pengukuran</th>
                      <th>Batas Threshold</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="filteredActiveAlarms.length === 0">
                      <td colspan="6" class="empty-row">Tidak ada alarm aktif yang cocok dengan penyaringan.</td>
                    </tr>
                    <tr v-for="a in filteredActiveAlarms" :key="a.id" class="alarm-row critical">
                      <td>{{ formatDate(a.timestamp) }}</td>
                      <td><strong>{{ a.deviceName || ('Device ID: ' + a.deviceId) }}</strong></td>
                      <td class="text-mono">{{ a.parameter }}</td>
                      <td class="text-mono critical-text">{{ a.value.toFixed(2) }}</td>
                      <td class="text-mono">{{ a.threshold.toFixed(2) }}</td>
                      <td>
                        <button @click="acknowledgeAlarm(a.id)" class="btn-ack animate-pulse">
                          ACKNOWLEDGE
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Historical Alarms (Acknowledged) -->
            <div class="glass-panel table-panel">
              <div class="panel-header">
                <h3>Riwayat Alarm Terdahulu (Acknowledged)</h3>
              </div>
              
              <div class="table-wrapper">
                <table class="scada-table">
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Objek Sensor</th>
                      <th>Parameter</th>
                      <th>Nilai Pengukuran</th>
                      <th>Batas Threshold</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="filteredAlarmHistory.length === 0">
                      <td colspan="6" class="empty-row">Belum ada riwayat alarm yang cocok dengan penyaringan.</td>
                    </tr>
                    <tr v-for="a in filteredAlarmHistory" :key="a.id">
                      <td>{{ formatDate(a.timestamp) }}</td>
                      <td>{{ a.deviceName || ('Device ID: ' + a.deviceId) }}</td>
                      <td class="text-mono">{{ a.parameter }}</td>
                      <td class="text-mono">{{ a.value.toFixed(2) }}</td>
                      <td class="text-mono">{{ a.threshold.toFixed(2) }}</td>
                      <td>
                        <span class="status-badge-text health-safe">RESOLVED</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <!-- PAGE D: DEVICE MANAGER -->
        <section v-else-if="activePage === 'devices'" class="page-sec flex-col">
          <div class="glass-panel table-panel full-width">
            <div class="panel-header">
              <div class="title-meta">
                <h3>Manajemen Objek Sensor (Modbus RTU)</h3>
                <p class="subtitle">Daftarkan dan konfigurasikan setpoint alarm pada perangkat RS485</p>
              </div>
              <button 
                v-if="userRole === 'admin'"
                @click="openAddDeviceModal" 
                class="btn-add-device"
              >
                + Tambah Perangkat Baru
              </button>
            </div>
            
            <div class="table-wrapper">
              <table class="scada-table">
                <thead>
                  <tr>
                    <th>Slave ID</th>
                    <th>Nama Objek Sensor</th>
                    <th>Lokasi</th>
                    <th>Temp Limit</th>
                    <th>Vel-Z Limit</th>
                    <th>Vel-X Limit</th>
                    <th>Acc-Z Limit</th>
                    <th>Acc-X Limit</th>
                    <th v-if="userRole === 'admin'">Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="devicesList.length === 0">
                    <td colspan="9" class="empty-row">Belum ada perangkat terdaftar di sistem.</td>
                  </tr>
                  <tr v-for="d in devicesList" :key="d.id">
                    <td class="text-mono text-gradient">#{{ d.slaveId }}</td>
                    <td><strong>{{ d.namaSensor }}</strong></td>
                    <td>{{ d.lokasi }}</td>
                    <td class="text-mono">{{ d.setpointTemp }} °C</td>
                    <td class="text-mono">{{ d.setpointZVel }} mm/s</td>
                    <td class="text-mono">{{ d.setpointXVel }} mm/s</td>
                    <td class="text-mono">{{ d.setpointZAcc }} mm/s²</td>
                    <td class="text-mono">{{ d.setpointXAcc }} mm/s²</td>
                    <td v-if="userRole === 'admin'">
                      <div class="action-btns">
                        <button @click="openEditDeviceModal(d)" class="edit-btn">EDIT</button>
                        <button @click="handleDeleteDevice(d.id)" class="del-btn">HAPUS</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- PAGE E: MODBUS CONFIG -->
        <section v-else-if="activePage === 'modbus-config'" class="page-sec flex-col modbus-config-page">
          
          <!-- Section A: TCP Connections -->
          <div class="glass-panel modbus-section">
            <div class="panel-header">
              <div class="title-meta">
                <h3>Koneksi Modbus TCP</h3>
                <p class="subtitle">Kelola koneksi IP/TCP ke gateway / PLC Modbus TCP</p>
              </div>
              <button @click="selectedConnectionForEdit = null; showModbusModal = true" class="btn-add-device">
                + Tambah Koneksi TCP
              </button>
            </div>

            <!-- Empty state -->
            <div v-if="modbusConnections.length === 0" class="modbus-empty">
              <div class="modbus-empty-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
              </div>
              <p>Belum ada koneksi Modbus TCP yang dikonfigurasi</p>
              <span>Klik "Tambah Koneksi TCP" untuk memulai</span>
            </div>

            <!-- Connection Cards -->
            <div v-else class="conn-card-list">
              <div 
                v-for="conn in modbusConnections" 
                :key="conn.id" 
                class="conn-card glass-panel"
                :class="{ 
                  'status-safe': conn.isOnline, 
                  'status-critical': !conn.isOnline && conn.isActive, 
                  'status-inactive': !conn.isActive 
                }"
              >
                <div class="conn-card-left">
                  <div class="conn-port-badge" :class="{ 'conn-active': conn.isOnline }">
                    <span class="conn-status-dot" :class="{ 'active': conn.isOnline }"></span>
                    <span class="text-mono">{{ conn.ipAddress }}:{{ conn.tcpPort }}</span>
                  </div>
                  <div class="conn-meta">
                    <span class="conn-poll">Interval Polling: {{ conn.pollInterval }}ms &bull; Timeout: {{ conn.timeout }}ms</span>
                  </div>
                </div>
                <div class="conn-card-right">
                  <span v-if="conn.isOnline" class="badge-active" style="background: rgba(16, 185, 129, 0.1); color: var(--status-safe); border: 1px solid rgba(16, 185, 129, 0.2);">ONLINE</span>
                  <span v-else-if="conn.isActive" class="badge-inactive" style="background: rgba(239, 68, 68, 0.1); color: var(--status-critical); border: 1px solid rgba(239, 68, 68, 0.2);">OFFLINE</span>
                  <span v-else class="badge-inactive">NON-AKTIF</span>

                  <!-- Test result -->
                  <div v-if="modbusTestResult[conn.id]" class="test-result" :class="{ 'ok': modbusTestResult[conn.id].ok, 'fail': !modbusTestResult[conn.id].ok && !modbusTestResult[conn.id].loading }">
                    <span v-if="modbusTestResult[conn.id].loading">Menguji...</span>
                    <span v-else>{{ modbusTestResult[conn.id].ok ? '✓' : '✗' }} {{ modbusTestResult[conn.id].message }}</span>
                  </div>

                  <div class="action-btns">
                    <button @click="testModbusConnection(conn.id)" class="test-btn" :disabled="modbusTestResult[conn.id]?.loading">TEST</button>
                    <button @click="selectedConnectionForEdit = conn; showModbusModal = true" class="edit-btn">EDIT</button>
                    <button @click="deleteModbusConnection(conn.id)" class="del-btn">HAPUS</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Section B: Register Address Mapping -->
          <div class="glass-panel modbus-section">
            <div class="panel-header">
              <div class="title-meta">
                <h3>Mapping Register Address per Device</h3>
                <p class="subtitle">Set alamat holding register Modbus untuk setiap parameter sensor</p>
              </div>
            </div>

            <div class="table-wrapper">
              <table class="scada-table">
                <thead>
                  <tr>
                    <th>Slave ID</th>
                    <th>Nama Sensor</th>
                    <th>Koneksi</th>
                    <th>Reg. Temp</th>
                    <th>Reg. Vel-Z</th>
                    <th>Reg. Vel-X</th>
                    <th>Reg. Acc-Z</th>
                    <th>Reg. Acc-X</th>
                    <th>Data Type</th>
                    <th>Byte Order</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="devicesList.length === 0">
                    <td colspan="11" class="empty-row">Belum ada perangkat terdaftar. Tambahkan device di Device Manager terlebih dahulu.</td>
                  </tr>
                  <tr v-for="d in devicesList" :key="d.id">
                    <td class="text-mono text-gradient">#{{ d.slaveId }}</td>
                    <td><strong>{{ d.namaSensor }}</strong></td>
                    <td>
                      <span v-if="d.connectionId" class="text-mono" style="color: var(--accent-primary);">{{ getConnectionName(d.connectionId) }}</span>
                      <span v-else class="badge-unconfigured">belum dikonfigurasi</span>
                    </td>
                    <td class="text-mono">
                      <div class="reg-cell-wrapper">
                        <span class="reg-addr">
                          {{ d.regTemp !== null && d.regTemp !== undefined ? d.regTemp : '—' }}
                          <span v-if="d.regTemp !== null && d.regTemp !== undefined && d.scaleTemp !== null && d.scaleTemp !== undefined && d.scaleTemp !== 1" class="reg-scale-hint">×{{ d.scaleTemp }}</span>
                        </span>
                        <span v-if="d.regTemp !== null && d.regTemp !== undefined" class="reg-hint" :class="getHintClass(getDeviceTelemetry(d.id)?.temperature)">
                          {{ getHintValue(getDeviceTelemetry(d.id)?.temperature, 1) }}
                        </span>
                      </div>
                    </td>
                    <td class="text-mono">
                      <div class="reg-cell-wrapper">
                        <span class="reg-addr">
                          {{ d.regZVel !== null && d.regZVel !== undefined ? d.regZVel : '—' }}
                          <span v-if="d.regZVel !== null && d.regZVel !== undefined && d.scaleZVel !== null && d.scaleZVel !== undefined && d.scaleZVel !== 1" class="reg-scale-hint">×{{ d.scaleZVel }}</span>
                        </span>
                        <span v-if="d.regZVel !== null && d.regZVel !== undefined" class="reg-hint" :class="getHintClass(getDeviceTelemetry(d.id)?.zVelocity)">
                          {{ getHintValue(getDeviceTelemetry(d.id)?.zVelocity, 2) }}
                        </span>
                      </div>
                    </td>
                    <td class="text-mono">
                      <div class="reg-cell-wrapper">
                        <span class="reg-addr">
                          {{ d.regXVel !== null && d.regXVel !== undefined ? d.regXVel : '—' }}
                          <span v-if="d.regXVel !== null && d.regXVel !== undefined && d.scaleXVel !== null && d.scaleXVel !== undefined && d.scaleXVel !== 1" class="reg-scale-hint">×{{ d.scaleXVel }}</span>
                        </span>
                        <span v-if="d.regXVel !== null && d.regXVel !== undefined" class="reg-hint" :class="getHintClass(getDeviceTelemetry(d.id)?.xVelocity)">
                          {{ getHintValue(getDeviceTelemetry(d.id)?.xVelocity, 2) }}
                        </span>
                      </div>
                    </td>
                    <td class="text-mono">
                      <div class="reg-cell-wrapper">
                        <span class="reg-addr">
                          {{ d.regZAcc !== null && d.regZAcc !== undefined ? d.regZAcc : '—' }}
                          <span v-if="d.regZAcc !== null && d.regZAcc !== undefined && d.scaleZAcc !== null && d.scaleZAcc !== undefined && d.scaleZAcc !== 1" class="reg-scale-hint">×{{ d.scaleZAcc }}</span>
                        </span>
                        <span v-if="d.regZAcc !== null && d.regZAcc !== undefined" class="reg-hint" :class="getHintClass(getDeviceTelemetry(d.id)?.zAcceleration)">
                          {{ getHintValue(getDeviceTelemetry(d.id)?.zAcceleration, 2) }}
                        </span>
                      </div>
                    </td>
                    <td class="text-mono">
                      <div class="reg-cell-wrapper">
                        <span class="reg-addr">
                          {{ d.regXAcc !== null && d.regXAcc !== undefined ? d.regXAcc : '—' }}
                          <span v-if="d.regXAcc !== null && d.regXAcc !== undefined && d.scaleXAcc !== null && d.scaleXAcc !== undefined && d.scaleXAcc !== 1" class="reg-scale-hint">×{{ d.scaleXAcc }}</span>
                        </span>
                        <span v-if="d.regXAcc !== null && d.regXAcc !== undefined" class="reg-hint" :class="getHintClass(getDeviceTelemetry(d.id)?.xAcceleration)">
                          {{ getHintValue(getDeviceTelemetry(d.id)?.xAcceleration, 2) }}
                        </span>
                      </div>
                    </td>
                    <td class="text-mono">{{ d.regDataType || '—' }}</td>
                    <td class="text-mono">{{ d.regByteOrder || '—' }}</td>
                    <td>
                      <button @click="selectedDeviceForRegister = d; showRegisterModal = true" class="edit-btn">KONFIGURASI</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </section>

        <!-- PAGE F: MASTER SETTING -->
        <section v-else-if="activePage === 'master-setting'" class="page-sec flex-col master-setting-page">
          <div class="glass-panel settings-container">
            <div class="panel-header">
              <div class="title-meta">
                <h3>Master Setting & Analytics Configuration</h3>
                <p class="subtitle">Atur parameter dasar, bobot alarm, standar ISO 10816, dan variabel analisis prediktif sistem</p>
              </div>
              <button @click="saveSystemSettings" class="btn-save-settings" :disabled="isSavingSettings">
                <span v-if="isSavingSettings">Menyimpan...</span>
                <span v-else>Simpan Pengaturan</span>
              </button>
            </div>
            
            <div class="settings-layout">
              <!-- Tabs / Navigasi Kiri -->
              <div class="settings-tabs">
                <button @click="activeSettingsTab = 'general'" class="tab-btn" :class="{ active: activeSettingsTab === 'general' }">
                  1. Kesehatan & Kapasitas
                </button>
                <button @click="activeSettingsTab = 'iso'" class="tab-btn" :class="{ active: activeSettingsTab === 'iso' }">
                  2. Kepatuhan ISO 10816
                </button>
                <button @click="activeSettingsTab = 'baseline'" class="tab-btn" :class="{ active: activeSettingsTab === 'baseline' }">
                  3. Deviasi & Anomali
                </button>
                <button @click="activeSettingsTab = 'predictive'" class="tab-btn" :class="{ active: activeSettingsTab === 'predictive' }">
                  4. Predictive Maintenance
                </button>
                <button @click="activeSettingsTab = 'sorting'" class="tab-btn" :class="{ active: activeSettingsTab === 'sorting' }">
                  5. Worst Performers
                </button>
              </div>
              
              <!-- Konten Kanan -->
              <div class="settings-tab-content">
                <!-- 1. KESEHATAN & KAPASITAS -->
                <div v-if="activeSettingsTab === 'general'" class="tab-pane">
                  <div class="logic-hint-block">
                    <strong>Hint Logika Perhitungan (Formula Kesehatan):</strong>
                    <p>Sistem menghitung persentase kesehatan berdasarkan total penalti dari alarm yang aktif di lapangan.</p>
                    <div class="math-formula-block">
                      <div class="math-equation">
                        <span class="math-var">Health Score</span> = 100 - (<span class="math-var">N</span><sub>warning</sub> × <span class="math-var">W</span><sub>weight</sub>) - (<span class="math-var">N</span><sub>critical</sub> × <span class="math-var">C</span><sub>weight</sub>)
                      </div>
                      <div class="math-explanation">
                        Di mana:
                        <ul>
                          <li><span class="math-var">N<sub>warning</sub></span>: Jumlah perangkat dengan status warning saat ini.</li>
                          <li><span class="math-var">W<sub>weight</sub></span>: Bobot warning alarm penalti.</li>
                          <li><span class="math-var">N<sub>critical</sub></span>: Jumlah perangkat dengan status critical saat ini.</li>
                          <li><span class="math-var">C<sub>weight</sub></span>: Bobot critical alarm penalti.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div class="form-grid">
                    <div class="form-group">
                      <label>Bobot Warning Alarm (%)</label>
                      <input type="number" v-model="systemSettings.bobotWarningAlarm" min="0" max="100" />
                      <span class="field-desc">Dampak pengurangan nilai kesehatan jika ada alarm kuning terdeteksi (Default: 5%).</span>
                    </div>
                    <div class="form-group">
                      <label>Bobot Critical Alarm (%)</label>
                      <input type="number" v-model="systemSettings.bobotCriticalAlarm" min="0" max="100" />
                      <span class="field-desc">Dampak pengurangan nilai kesehatan jika ada alarm merah terdeteksi (Default: 15%).</span>
                    </div>
                    <div class="form-group">
                      <label>Ambang Batas Kapasitas Sistem (Records)</label>
                      <input type="number" v-model="systemSettings.ambangKapasitasSistem" min="1000" />
                      <span class="field-desc">Beban pemrosesan data historis maksimum sebelum indikator kapasitas berubah menjadi merah (Default: 5.000.000 records).</span>
                    </div>
                  </div>
                </div>

                <!-- 2. KEPATUHAN STANDAR ISO 10816 -->
                <div v-if="activeSettingsTab === 'iso'" class="tab-pane">
                  <div class="logic-hint-block">
                    <strong>Hint Logika Perhitungan (Klasifikasi Zone ISO 10816):</strong>
                    <p>Vibrasi RMS Velocity (<span class="math-var">v</span><sub>RMS</sub>) dipetakan ke 4 zona kepatuhan:</p>
                    <div class="math-formula-block">
                      <div class="math-equation">
                        Zone A: <span class="math-var">v</span><sub>RMS</sub> &lt; <span class="math-var">Limit</span><sub>B</sub>
                      </div>
                      <div class="math-equation">
                        Zone B: <span class="math-var">Limit</span><sub>B</sub> ≤ <span class="math-var">v</span><sub>RMS</sub> &lt; <span class="math-var">Limit</span><sub>C</sub>
                      </div>
                      <div class="math-equation">
                        Zone C: <span class="math-var">Limit</span><sub>C</sub> ≤ <span class="math-var">v</span><sub>RMS</sub> &lt; <span class="math-var">Limit</span><sub>D</sub>
                      </div>
                      <div class="math-equation">
                        Zone D: <span class="math-var">v</span><sub>RMS</sub> ≥ <span class="math-var">Limit</span><sub>D</sub>
                      </div>
                      <div class="math-explanation">
                        Di mana:
                        <ul>
                          <li><span class="math-var">v<sub>RMS</sub></span>: Kecepatan getaran tertinggi (Max of X/Z-Velocity) dalam mm/s.</li>
                          <li><span class="math-var">Limit<sub>B</sub>, Limit<sub>C</sub>, Limit<sub>D</sub></span>: Batas bawah masing-masing zone getaran yang diatur di bawah.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div class="form-grid">
                    <div class="form-group">
                      <label>Pilihan Kelas Mesin</label>
                      <select v-model="systemSettings.pilihanKelasMesin" @change="onMachineClassChange">
                        <option value="Class I">Class I (Mesin Kecil &lt; 15 kW)</option>
                        <option value="Class II">Class II (Mesin Sedang 15 kW - 75 kW)</option>
                        <option value="Class III">Class III (Mesin Besar dengan Fondasi Kokoh)</option>
                        <option value="Class IV">Class IV (Mesin Besar dengan Fondasi Fleksibel)</option>
                      </select>
                      <span class="field-desc">Kelas default mesin yang digunakan di seluruh pabrik.</span>
                    </div>
                    <div class="form-group">
                      <label>Batas Bawah Zone B (mm/s)</label>
                      <input type="number" v-model="systemSettings.batasBawahZoneB" step="0.01" min="0" />
                      <span class="field-desc">Kecepatan RMS maksimum untuk Zone A. Mulai dari nilai ini adalah Zone B (Default: {{ defaultZoneBLimit }} mm/s).</span>
                    </div>
                    <div class="form-group">
                      <label>Batas Bawah Zone C (mm/s)</label>
                      <input type="number" v-model="systemSettings.batasBawahZoneC" step="0.01" min="0" />
                      <span class="field-desc">Kecepatan RMS maksimum untuk Zone B. Mulai dari nilai ini adalah Zone C (Default: {{ defaultZoneCLimit }} mm/s).</span>
                    </div>
                    <div class="form-group">
                      <label>Batas Bawah Zone D (mm/s)</label>
                      <input type="number" v-model="systemSettings.batasBawahZoneD" step="0.01" min="0" />
                      <span class="field-desc">Kecepatan RMS maksimum untuk Zone C. Di atas nilai ini diklasifikasikan sebagai Zone D / Danger (Default: {{ defaultZoneDLimit }} mm/s).</span>
                    </div>
                  </div>
                </div>

                <!-- 3. DEVIAASI BASELINE & DETEKSI ANOMALI -->
                <div v-if="activeSettingsTab === 'baseline'" class="tab-pane">
                  <div class="logic-hint-block">
                    <strong>Hint Logika Perhitungan (Statistik Deteksi Anomali):</strong>
                    <p>Sistem menggunakan analisis signifikansi statistik (Z-Score) getaran real-time terhadap rata-rata historis (baseline).</p>
                    <div class="math-formula-block">
                      <div class="math-equation">
                        <span class="math-var">Z-Score (Z)</span> = 
                        <div class="math-fraction">
                          <div class="numerator"><span class="math-var">x</span> - <span class="math-symbol">μ</span></div>
                          <div class="denominator"><span class="math-symbol">σ</span></div>
                        </div>
                      </div>
                      <div class="math-equation">
                        <span class="math-var">Anomaly Alert</span> = |<span class="math-var">Z</span>| ≥ <span class="math-var">Threshold</span><sub>Z</sub>
                      </div>
                      <div class="math-explanation">
                        Di mana:
                        <ul>
                          <li><span class="math-var">x</span>: Nilai RMS getaran sensor saat ini.</li>
                          <li><span class="math-symbol">μ</span>: Rata-rata (<span class="math-var">Mean</span>) data historis selama <span class="math-var">N</span> hari baseline.</li>
                          <li><span class="math-symbol">σ</span>: Standar deviasi (<span class="math-var">StdDev</span>) data historis baseline.</li>
                          <li><span class="math-var">Threshold<sub>Z</sub></span>: Batas deviasi getaran yang dipengaruhi oleh tingkat sensitivitas (Low: 4.0σ, Medium: 3.0σ, High: 2.0σ).</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div class="form-grid">
                    <div class="form-group">
                      <label>Jendela Waktu Baseline (Hari)</label>
                      <input type="number" v-model="systemSettings.jendelaWaktuBaseline" min="1" max="90" />
                      <span class="field-desc">Durasi data historis ke belakang yang dihitung rata-ratanya sebagai nilai acuan normal (Default: 7 Hari).</span>
                    </div>
                    <div class="form-group">
                      <label>Toleransi Deviasi Maksimal (%)</label>
                      <input type="number" v-model="systemSettings.toleransiDeviasiMaksimal" min="0" max="1000" />
                      <span class="field-desc">Batas lonjakan getaran dari baseline sebelum dianggap sebagai alarm penyimpangan getaran (Default: 20%).</span>
                    </div>
                    <div class="form-group">
                      <label>Sensitivitas Deteksi Anomali</label>
                      <select v-model="systemSettings.sensitivitasDeteksiAnomali">
                        <option value="Low">Low Sensitivity (Z-score &ge; 4.0σ)</option>
                        <option value="Medium">Medium Sensitivity (Z-score &ge; 3.0σ)</option>
                        <option value="High">High Sensitivity (Z-score &ge; 2.0σ)</option>
                      </select>
                      <span class="field-desc">Sensitivitas standard deviasi algoritma deteksi Z-score terhadap variansi getaran (Default: Medium).</span>
                    </div>
                  </div>
                </div>

                <!-- 4. ESTIMASI WAKTU PEMELIHARAAN -->
                <div v-if="activeSettingsTab === 'predictive'" class="tab-pane">
                  <div class="logic-hint-block">
                    <strong>Hint Logika Perhitungan (Analisis Prediktif Linier):</strong>
                    <p>Memproyeksikan sisa waktu operasi menggunakan regresi linear berbasis data tren historis beberapa hari terakhir.</p>
                    <div class="math-formula-block">
                      <div class="math-equation">
                        <span class="math-var">y</span> = <span class="math-var">m</span><span class="math-var">x</span> + <span class="math-var">c</span>
                      </div>
                      <div class="math-equation">
                        <span class="math-var">m</span> (Slope) = 
                        <div class="math-fraction">
                          <div class="numerator"><span class="math-var">n</span>∑(<span class="math-var">x</span><span class="math-var">y</span>) - ∑<span class="math-var">x</span>∑<span class="math-var">y</span></div>
                          <div class="denominator"><span class="math-var">n</span>∑(<span class="math-var">x</span><sup>2</sup>) - (∑<span class="math-var">x</span>)<sup>2</sup></div>
                        </div>
                      </div>
                      <div class="math-equation">
                        <span class="math-var">Days to Failure</span> = 
                        <div class="math-fraction">
                          <div class="numerator"><span class="math-var">Threshold</span><sub>Failure</sub> - <span class="math-var">y</span><sub>latest</sub></div>
                          <div class="denominator"><span class="math-var">m</span></div>
                        </div>
                      </div>
                      <div class="math-explanation">
                        Di mana:
                        <ul>
                          <li><span class="math-var">m</span>: Gradien/Laju degradasi keausan mesin (nilai kenaikan vibrasi per hari).</li>
                          <li><span class="math-var">n</span>: Jumlah data titik pengukuran.</li>
                          <li><span class="math-var">Threshold<sub>Failure</sub></span>: Batas kritis kegagalan fisik mesin (mm/s).</li>
                          <li><span class="math-var">y<sub>latest</sub></span>: Nilai RMS getaran terakhir.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div class="form-grid">
                    <div class="form-group">
                      <label>Data Points Regression (Hari)</label>
                      <input type="number" v-model="systemSettings.dataPointsRegression" min="3" max="60" />
                      <span class="field-desc">Berapa hari data ke belakang yang diolah ke dalam algoritma regresi linear (Default: 14 Hari).</span>
                    </div>
                    <div class="form-group">
                      <label>Threshold Kritis Kegagalan (mm/s)</label>
                      <input type="number" v-model="systemSettings.thresholdKritisKegagalan" step="0.01" min="0" />
                      <span class="field-desc">Nilai target Velocity RMS kritis (Failure Threshold) di mana jika tren regresi menyentuhnya, mesin diprediksi rusak (Default: 7.10 mm/s).</span>
                    </div>
                    <div class="form-group">
                      <label>Batas Peringatan H- (Hari)</label>
                      <input type="number" v-model="systemSettings.batasPeringatanHari" min="1" max="90" />
                      <span class="field-desc">Sistem memicu indikator peringatan pemeliharaan visual jika estimasi hari rusak kurang dari batas ini (Default: 15 Hari).</span>
                    </div>
                  </div>
                </div>

                <!-- 5. TOP 3 WORST PERFORMERS -->
                <div v-if="activeSettingsTab === 'sorting'" class="tab-pane">
                  <div class="logic-hint-block">
                    <strong>Hint Logika Perhitungan (Matriks Prioritas Pemeliharaan):</strong>
                    <p>Menentukan skor peringkat 3 terburuk berdasarkan metrik prioritas yang dipilih:</p>
                    <div class="math-formula-block">
                      <div class="math-equation">
                        1. Alarm: <span class="math-var">Score</span> = ∑ <span class="math-var">Alarms</span><sub>(active + resolved)</sub>
                      </div>
                      <div class="math-equation">
                        2. Vibration: <span class="math-var">Score</span> = 
                        <div class="math-fraction">
                          <div class="numerator"><span class="math-var">v</span><sub>latest</sub></div>
                          <div class="denominator"><span class="math-var">Setpoint</span></div>
                        </div>
                        × 100%
                      </div>
                      <div class="math-equation">
                        3. Baseline: <span class="math-var">Score</span> = |<span class="math-var">Z</span>|<sub>max</sub>
                      </div>
                      <div class="math-explanation">
                        Di mana:
                        <ul>
                          <li>Sistem akan menyortir perangkat dari skor tertinggi ke terendah, lalu menampilkan 3 perangkat dengan skor penalti tertinggi pada dashboard.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div class="form-grid">
                    <div class="form-group">
                      <label>Metrik Pengurutan Performa Terburuk</label>
                      <select v-model="systemSettings.metrikPengurutan">
                        <option value="alarmFrequency">Frekuensi Alarm Tertinggi (Jumlah alarm aktif & resolved)</option>
                        <option value="peakVibration">Nilai Peak Vibrasi Tertinggi (% tertinggi terhadap limit)</option>
                        <option value="baselineDeviation">Deviasi Baseline Terbesar (Z-score tertinggi)</option>
                      </select>
                      <span class="field-desc">Acuan metrik yang digunakan untuk menyortir urutan perangkat terburuk di sistem (Default: Frekuensi Alarm).</span>
                    </div>
                    <div class="form-group">
                      <label>Rentang Waktu Evaluasi (Jam)</label>
                      <input type="number" v-model="systemSettings.rentangWaktuEvaluasi" min="1" />
                      <span class="field-desc">Window historis pencarian data alarm atau puncak getaran untuk evaluasi metrik (Default: 168 Jam / 7 Hari).</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  </div>

  <!-- CRUD MODAL POPUP -->
  <DeviceModal 
    :show="showDeviceModal"
    :device="selectedDeviceForEdit"
    @close="showDeviceModal = false"
    @save="handleSaveDevice"
  />

  <!-- Modbus Connection Modal -->
  <ModbusConfigModal
    :show="showModbusModal"
    :connection="selectedConnectionForEdit"
    @close="showModbusModal = false; selectedConnectionForEdit = null"
    @save="saveModbusConnection"
  />

  <!-- Modbus Register Address Modal -->
  <ModbusRegisterModal
    :show="showRegisterModal"
    :device="selectedDeviceForRegister"
    :connections="modbusConnections"
    @close="showRegisterModal = false; selectedDeviceForRegister = null"
    @save="saveDeviceModbusConfig"
  />
</template>

<style>
/* CSS Styling for full page layout */
.login-viewport {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
}

.login-box {
  width: 100%;
  max-width: 420px;
  padding: 40px;
  background: var(--bg-panel);
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-color);
  text-align: center;
}

.login-box .logo-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 8px;
}

.company-logo-login {
  max-width: 160px;
  height: auto;
  margin-bottom: 8px;
}

.login-sub {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 24px;
}

.login-error {
  background: var(--status-critical-glow);
  color: var(--status-critical);
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.15);
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 20px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-group label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  text-align: left;
}

.input-group input {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.input-group input:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.login-btn {
  background: var(--accent-primary);
  border: none;
  color: white;
  padding: 14px;
  border-radius: var(--radius-md);
  font-weight: 700;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  margin-top: 10px;
  transition: background-color 0.2s ease, transform 0.1s ease, box-shadow 0.2s ease;
}

.login-btn:hover {
  background: var(--accent-hover);
  box-shadow: var(--shadow-md);
}

.login-btn:active {
  transform: scale(0.98);
}

.login-hint {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.6;
  text-align: left;
}

/* SCADA VIEWPORT LAYOUT */
.scada-viewport {
  width: 100vw;
  height: 100vh;
  display: flex;
  background-color: var(--bg-space);
  overflow: hidden;
}

.scada-sidebar {
  width: var(--sidebar-width);
  height: 100%;
  background: var(--bg-sidebar);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  z-index: 10;
}

.scada-sidebar .brand {
  height: var(--header-height);
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.scada-sidebar .brand .company-logo {
  width: 140px;
  max-width: 90%;
  height: auto;
  object-fit: contain;
  border-radius: 6px;
  flex-shrink: 0;
}

.pulse-icon {
  width: 8px;
  height: 8px;
  background: var(--accent-cyan);
  border-radius: 50%;
  box-shadow: 0 0 10px var(--accent-cyan);
}

.nav-links {
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  background: transparent;
  border: none;
  color: var(--text-on-dark-muted);
  padding: 12px 16px;
  border-radius: var(--radius-md);
  font-family: inherit;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  text-align: left;
  position: relative;
  transition: all 0.2s ease;
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-on-dark);
}

.nav-btn.active {
  background: var(--accent-primary);
  color: var(--text-on-dark);
  border: 1px solid var(--accent-primary);
}

.badge-count {
  position: absolute;
  right: 16px;
  background: var(--status-critical);
  color: white;
  font-size: 0.65rem;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
}

/* Sidebar mini telemetry view */
.sidebar-devices-sec {
  flex-grow: 1;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-devices-sec h4 {
  font-size: 0.7rem;
  font-weight: 800;
  color: var(--text-on-dark-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
  padding-left: 8px;
}

.device-mini-list {
  flex-grow: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 4px;
}

.mini-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: var(--radius-md);
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.mini-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.mini-item.active {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
}

.mini-item .status-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.mini-item.conn-ok .status-indicator {
  background-color: var(--status-safe);
  box-shadow: 0 0 6px var(--status-safe);
}

.mini-item.conn-err .status-indicator {
  background-color: var(--status-critical);
  box-shadow: 0 0 6px var(--status-critical);
}

.mini-item.safe .status-indicator {
  background-color: var(--status-safe);
  box-shadow: 0 0 6px var(--status-safe);
}

.mini-item.warning .status-indicator {
  background-color: var(--status-warning);
  box-shadow: 0 0 6px var(--status-warning);
}

.mini-item.critical .status-indicator {
  background-color: var(--status-critical);
  box-shadow: 0 0 6px var(--status-critical);
}

.mini-item .meta {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: hidden;
}

.mini-item .meta .name {
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-item .meta .name {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-on-dark);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-item .meta .loc {
  font-size: 0.65rem;
  color: var(--text-on-dark-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-item .mini-val {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-on-dark-muted);
}

.user-block {
  padding: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.role-badge {
  font-size: 0.6rem;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
}

.role-badge.admin {
  background: var(--status-warning-glow);
  color: var(--status-warning);
}

.role-badge.user {
  background: var(--status-safe-glow);
  color: var(--status-safe);
}

.username {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-on-dark);
}

.btn-logout {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: var(--text-on-dark-muted);
  padding: 8px;
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-logout:hover {
  background: var(--status-critical);
  color: var(--text-on-dark);
  border-color: var(--status-critical);
}

/* SIDEBAR CONTACT BRANDING */
.sidebar-contact {
  padding: 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.12);
}

.scada-sidebar .sidebar-contact .contact-title {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-on-dark-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.sidebar-contact .contact-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sidebar-contact .contact-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.68rem;
  color: var(--text-on-dark-muted);
  line-height: 1.3;
  margin: 0;
}

.sidebar-contact .contact-icon {
  flex-shrink: 0;
  width: 14px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 3px;
  color: var(--text-muted);
}

.sidebar-contact .contact-icon svg {
  stroke: currentColor;
}

.sidebar-contact .contact-text {
  word-break: break-word;
}

/* SCADA CONTENT GRID CONTAINER */
.scada-content-container {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.scada-header {
  height: var(--header-height);
  padding: 0 32px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-header);
  flex-shrink: 0;
}

.scada-header h2 {
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  display: inline-block;
  margin-right: 16px;
  color: var(--text-on-dark);
}

.server-status {
  font-size: 0.75rem;
  color: var(--text-on-dark-muted);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.green-dot {
  width: 6px;
  height: 6px;
  background: var(--status-safe);
  border-radius: 50%;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.clock-display {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-on-dark);
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 6px 14px;
  border-radius: var(--radius-md);
  letter-spacing: 0.5px;
}

.theme-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: var(--text-on-dark-muted);
  padding: 8px 12px;
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-on-dark);
}

.system-main-title {
  color: var(--text-on-dark);
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}

.dummy-active {
  background: rgba(245, 158, 11, 0.12) !important;
  border-color: rgba(245, 158, 11, 0.5) !important;
  color: #f59e0b !important;
}

.demo-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 32px;
  background: linear-gradient(90deg, rgba(245, 158, 11, 0.10) 0%, rgba(245, 158, 11, 0.04) 100%);
  border-bottom: 1px solid rgba(245, 158, 11, 0.25);
  color: #f59e0b;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.2px;
  flex-shrink: 0;
}

.demo-banner strong {
  font-weight: 800;
  letter-spacing: 0.5px;
}

/* MAIN SCROLLABLE VIEWPORT */
.scada-main-content {
  flex-grow: 1;
  padding: 32px;
  overflow-y: auto;
  background-color: var(--bg-space);
}

.page-sec {
  width: 100%;
  height: 100%;
  display: flex;
  gap: 24px;
}

.page-sec.flex-col {
  flex-direction: column;
}

/* OVERVIEW DASHBOARD SPECIFICS */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.stat-card {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-card .lbl {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.stat-card .val {
  font-size: 2.2rem;
  font-weight: 800;
  line-height: 1;
}

.alarm-bg.critical {
  background: var(--status-critical-glow);
  border-color: rgba(239, 68, 68, 0.2);
  color: var(--status-critical);
}

.devices-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 24px;
}

.overview-device-card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.overview-device-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.overview-device-card .card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.overview-device-card h3 {
  font-size: 1rem;
  font-weight: 700;
}

.overview-device-card .loc {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.overview-device-card .status-text {
  font-size: 0.65rem;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
}

.overview-device-card.safe .status-text {
  color: var(--status-safe);
  background: var(--status-safe-glow);
}
.overview-device-card.warning .status-text {
  color: var(--status-warning);
  background: var(--status-warning-glow);
}
.overview-device-card.critical .status-text {
  color: var(--status-critical);
  background: var(--status-critical-glow);
}

.telemetry-block {
  display: grid;
  grid-template-columns: auto 1fr 1fr;
  grid-template-areas: 
    "temp vibz accz"
    "temp vibx accx";
  gap: 12px;
  background: var(--bg-input);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.telemetry-block.empty-block {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: var(--text-muted);
  height: 62px;
}

.telemetry-block .tel-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tel-col.temp {
  grid-area: temp;
  justify-content: center;
  border-right: 1px solid var(--border-color);
  padding-right: 12px;
}

.tel-col.vibz { grid-area: vibz; }
.tel-col.accz { grid-area: accz; }
.tel-col.vibx { grid-area: vibx; }
.tel-col.accx { grid-area: accx; }

.telemetry-block .tel-col .label {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--text-muted);
}

.telemetry-block .tel-col .num {
  font-size: 0.95rem;
  font-weight: 700;
}

.telemetry-block .tel-col .num .u {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.overview-device-card .card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
}

.slave-tag {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-weight: 500;
}

.btn-detail {
  background: transparent;
  border: none;
  color: var(--accent-primary);
  font-size: 0.75rem;
  font-weight: 800;
  cursor: pointer;
}

.btn-detail:hover {
  text-decoration: underline;
}

/* SENSORS DETAIL VIEW STACK LAYOUT */
.detail-stack-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.detail-top-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 1024px) {
  .detail-top-section {
    grid-template-columns: 1fr;
    max-height: unset;
  }
}

.detail-metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.svg-wrapper {
  width: 100%;
  height: 100%;
}

.detail-bottom-section {
  width: 100%;
  min-height: 40vh;
  flex: 1;
}

/* COMPARISON GRID CARDS */
.comparison-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

@media (max-width: 1200px) {
  .comparison-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.comp-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.comp-card h4 {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 8px;
}

.comp-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.comp-bar-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.comp-bar-row:hover {
  transform: translateX(3px);
}

.comp-lbl {
  font-size: 0.65rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.comp-bar-track {
  width: 100%;
  height: 8px;
  background: rgba(9, 30, 66, 0.06);
  border-radius: 4px;
  overflow: hidden;
  transition: background-color 0.2s ease;
}

.comp-bar-row:hover .comp-bar-track {
  background: rgba(9, 30, 66, 0.1);
}

.comp-bar-fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #36b37e 0%, #00b8d9 100%);
  transition: width 0.3s ease;
}

.comp-bar-fill.warning {
  background: linear-gradient(90deg, #ffab00 0%, #ff8b00 100%);
}

.comp-bar-fill.critical {
  background: linear-gradient(90deg, #ff5630 0%, #bf2600 100%);
}

.comp-val {
  font-size: 0.75rem;
  font-weight: 700;
  align-self: flex-end;
}

/* LOG ALARM SPECIFICS */
.alarm-view-layout {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.table-panel {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.table-panel.full-width {
  width: 100%;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h3 {
  font-size: 1.1rem;
  font-weight: 700;
}

.panel-header .subtitle {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

.alarm-badge {
  font-size: 0.7rem;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 4px;
}

.alarm-badge.critical {
  background: var(--status-critical-glow);
  color: var(--status-critical);
}

.table-wrapper {
  overflow-x: auto;
}

.scada-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.scada-table th {
  padding: 12px 18px;
  border-bottom: 2px solid var(--border-color);
  background: rgba(9, 30, 66, 0.04);
  color: var(--text-secondary);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.scada-table td {
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.82rem;
  color: var(--text-primary);
}

.scada-table tbody tr {
  transition: background-color 0.15s ease;
}

.scada-table tbody tr:hover {
  background: rgba(9, 30, 66, 0.015);
}

.scada-table .empty-row {
  text-align: center;
  color: var(--text-muted);
  padding: 40px;
}

.alarm-row.critical {
  background: rgba(255, 86, 48, 0.04);
}

.critical-text {
  color: var(--status-critical);
  font-weight: 700;
}

.btn-ack {
  background: rgba(255, 86, 48, 0.06);
  border: 1px solid rgba(255, 86, 48, 0.2);
  color: var(--status-critical);
  padding: 6px 14px;
  border-radius: var(--radius-md);
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  letter-spacing: 0.5px;
}

.btn-ack:hover {
  background: var(--status-critical);
  color: white;
  border-color: var(--status-critical);
  box-shadow: 0 4px 10px rgba(255, 86, 48, 0.25);
  transform: translateY(-1px);
}

.btn-ack:active {
  transform: scale(0.97);
}

.btn-add-device {
  background: var(--accent-primary);
  border: none;
  color: white;
  padding: 10px 20px;
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.btn-add-device:hover {
  background: var(--accent-hover);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.btn-add-device:active {
  transform: scale(0.98);
}

.action-btns {
  display: flex;
  gap: 8px;
}

.edit-btn, .del-btn {
  background: #ffffff;
  border: 1px solid var(--border-color);
  padding: 5px 12px;
  border-radius: var(--radius-md);
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.edit-btn {
  color: var(--accent-primary);
  border-color: var(--border-color);
}

.edit-btn:hover {
  background: rgba(0, 82, 204, 0.05);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.del-btn {
  color: var(--status-critical);
  border-color: var(--border-color);
}

.del-btn:hover {
  background: rgba(255, 86, 48, 0.05);
  border-color: var(--status-critical);
  color: var(--status-critical);
}

/* ========================
   MODBUS CONFIG PAGE STYLES
   ======================== */
.modbus-config-page {
  gap: 20px;
}

.modbus-section {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Empty state */
.modbus-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px;
  color: var(--text-secondary);
}

.modbus-empty-icon {
  color: var(--text-muted);
  opacity: 0.4;
  margin-bottom: 8px;
}

.modbus-empty p { font-weight: 600; font-size: 0.95rem; }
.modbus-empty span { font-size: 0.8rem; color: var(--text-muted); }

/* Connection Cards */
.conn-card-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.conn-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-radius: var(--radius-lg);
  gap: 16px;
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), border-color 0.2s;
}

.conn-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.conn-card-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.conn-port-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 700;
  min-width: 100px;
}

.conn-port-badge.conn-active {
  border-color: rgba(0, 210, 255, 0.35);
  background: rgba(0, 210, 255, 0.06);
}

.conn-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
  flex-shrink: 0;
}

.conn-status-dot.active {
  background: var(--status-safe);
  box-shadow: 0 0 8px var(--status-safe);
  animation: pulse-soft 2s infinite;
}

.conn-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.conn-settings {
  font-size: 0.9rem;
  color: var(--text-primary);
  font-weight: 600;
}

.conn-poll {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.conn-card-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.badge-active {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 1px;
  padding: 3px 10px;
  border-radius: 99px;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.4);
  color: var(--status-safe);
}

.badge-inactive {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 1px;
  padding: 3px 10px;
  border-radius: 99px;
  background: rgba(148, 163, 184, 0.1);
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: var(--text-muted);
}

.badge-unconfigured {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  color: var(--status-warning);
  font-style: italic;
}

.test-result {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  max-width: 280px;
  text-align: right;
  line-height: 1.4;
}

.test-result.ok {
  color: var(--status-safe);
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.test-result.fail {
  color: var(--status-critical);
  background: var(--status-critical-glow);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.test-btn {
  padding: 6px 14px;
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid rgba(0, 210, 255, 0.25);
  background: rgba(0, 210, 255, 0.08);
  color: var(--accent-primary);
  transition: all 0.15s;
}

.test-btn:hover:not(:disabled) {
  background: rgba(0, 210, 255, 0.15);
  border-color: rgba(0, 210, 255, 0.5);
}

.test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.reg-cell-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.reg-addr {
  font-size: 0.9rem;
  font-weight: 500;
}

.reg-scale-hint {
  font-size: 0.7rem;
  color: var(--accent-cyan);
  background: rgba(0, 210, 255, 0.08);
  padding: 1px 4px;
  border-radius: 4px;
  margin-left: 5px;
  font-weight: 700;
  border: 1px solid rgba(0, 210, 255, 0.15);
  display: inline-block;
  vertical-align: middle;
}

.reg-hint {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 4px;
  display: inline-block;
  font-family: 'JetBrains Mono', monospace;
}

.hint-ok {
  color: var(--accent-cyan);
  background: rgba(0, 243, 255, 0.08);
  border: 1px solid rgba(0, 243, 255, 0.15);
}

.hint-zero {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.08);
  border: 1px solid rgba(251, 191, 36, 0.15);
}

.hint-null {
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.offline-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 16px 0;
  text-align: center;
  color: var(--text-muted);
}

.offline-placeholder svg {
  color: var(--status-critical);
  margin-bottom: 8px;
  opacity: 0.8;
}

.offline-placeholder p {
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 4px;
}

.offline-placeholder .last-update {
  font-size: 0.75rem;
  color: var(--accent-cyan);
  font-family: 'JetBrains Mono', monospace;
}

.last-update-hint {
  font-size: 0.68rem;
  color: var(--accent-cyan);
  margin-top: 4px;
  font-family: 'JetBrains Mono', monospace;
  opacity: 0.85;
  font-weight: 500;
  letter-spacing: 0.2px;
}

/* =========================================================================
   ADVANCED PERFORMANCE ANALYTICS STYLING (PLANNING #8)
   ========================================================================= */
.advanced-analytics-container {
  display: flex;
  flex-direction: column;
}

.analytics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 0;
  width: 100%;
}

@media (max-width: 1300px) {
  .analytics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 700px) {
  .analytics-grid {
    grid-template-columns: 1fr;
  }
}

.analytics-card {
  padding: 20px;
  min-height: 210px;
  height: 210px;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), border-color 0.2s, box-shadow 0.25s;
}

.analytics-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-hover);
  box-shadow: var(--shadow-md);
}

.analytics-card .card-title {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: var(--text-secondary);
  margin-bottom: 16px;
  text-transform: uppercase;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding-bottom: 6px;
}

/* Card 1: Horizontal Health Card Layout */
.health-card-body {
  display: flex;
  align-items: center;
  gap: 24px;
  flex: 1;
  width: 100%;
  min-height: 120px;
}

.health-gauge-section {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
}

.health-info-section {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 14px;
  flex: 1;
  align-self: center;
}

.health-status-badge {
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 6px;
  display: inline-block;
  width: fit-content;
}

.health-status-badge.safe {
  color: var(--status-safe);
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.15);
}

.health-status-badge.warning {
  color: var(--status-warning);
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.15);
}

.health-status-badge.critical {
  color: var(--status-critical);
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.15);
}

.capacity-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.capacity-label {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.capacity-count-display {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.capacity-count-display .count-num {
  font-size: 1.8rem;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1;
}

.capacity-count-display .count-unit {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
}

/* Separator Line between Analytics & Realtime Data */
.scada-section-divider {
  border: none;
  height: 1px;
  background: var(--border-color);
  margin: 20px 0;
  flex-shrink: 0;
}

/* Card 2: ISO Donut & Regulation Info */
.iso-donut-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 16px;
  flex: 1;
}

.donut-chart {
  position: relative;
  width: 105px;
  height: 105px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.donut-hole {
  width: 77px;
  height: 77px;
  border-radius: 50%;
  background: var(--bg-panel) !important;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.iso-info-note {
  font-size: 0.65rem;
  color: var(--text-muted);
  line-height: 1.3;
  margin-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  padding-top: 6px;
  text-align: center;
}

.donut-hole .pct {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.donut-hole .lbl {
  font-size: 0.5rem;
  font-weight: 700;
  color: var(--text-secondary);
  letter-spacing: 0.2px;
}

.iso-legend {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-item .color-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.legend-item .color-dot.zone-a { background: #10b981; }
.legend-item .color-dot.zone-b { background: #06b6d4; }
.legend-item .color-dot.zone-c { background: #f59e0b; }
.legend-item .color-dot.zone-d { background: #ef4444; }

.legend-item .lbl {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--text-primary);
}

/* Card 3: Alarm Trend */
.card-header-flex {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.trend-badge {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 12px;
}

.trend-badge.good {
  color: var(--status-safe);
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.trend-badge.bad {
  color: var(--status-critical);
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.trend-bars-wrapper {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

/* Card 4: Active Alarms */
.alarm-val-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.alarm-val-wrapper .count {
  font-size: 2.2rem;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1;
}

.alarm-val-wrapper .count.critical-text {
  color: var(--status-critical);
}

.alarm-val-wrapper .desc {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

.alarm-status-indicator {
  text-align: center;
  margin-top: 8px;
}

.badge-active-alarm {
  font-size: 0.65rem;
  font-weight: 800;
  padding: 3px 10px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: var(--status-critical);
  border-radius: 20px;
  letter-spacing: 0.5px;
}

.badge-safe-alarm {
  font-size: 0.65rem;
  font-weight: 800;
  padding: 3px 10px;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.25);
  color: var(--status-safe);
  border-radius: 20px;
  letter-spacing: 0.5px;
}

/* Card 5: Status Monitoring */
.status-badge-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
}

.status-neon-glow {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 12px;
  font-weight: 800;
  font-size: 0.95rem;
  letter-spacing: 0.5px;
}

.status-neon-glow.safe {
  color: var(--status-safe);
  background: rgba(16, 185, 129, 0.04);
  border: 1px solid rgba(16, 185, 129, 0.1);
}

.status-neon-glow.critical {
  color: var(--status-critical);
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.15);
}

.status-hint-desc {
  font-size: 0.65rem;
  color: var(--text-secondary);
  text-align: center;
  margin-top: 8px;
}

/* Card 6: Worst Performers */
.worst-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

.worst-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.worst-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
}

.worst-info .name {
  font-weight: 600;
  color: var(--text-primary);
}

.worst-info .param {
  color: var(--text-secondary);
  font-size: 0.65rem;
}

.worst-progress-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.worst-progress-track {
  flex: 1;
  height: 4px;
  background: rgba(9, 30, 66, 0.08);
  border-radius: 2px;
  overflow: hidden;
}

.worst-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--status-warning), var(--status-critical));
  border-radius: 2px;
}

.worst-progress-wrapper .ratio {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--status-critical);
  min-width: 55px;
  text-align: right;
}

/* Card 7: Regression */
.regression-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  flex: 1;
  gap: 8px;
}

.regression-badge-glow {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 16px;
  background: rgba(239, 68, 68, 0.04);
  border: 1px solid rgba(239, 68, 68, 0.1);
  border-radius: 10px;
}

.regression-badge-glow .days {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--status-critical);
}

.regression-badge-glow .lbl {
  font-size: 0.58rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.maintenance-hint {
  font-size: 0.65rem;
  color: var(--text-primary);
  text-align: center;
  line-height: 1.3;
}

.sparkline-wrapper {
  width: 100%;
  opacity: 0.7;
}

/* Card 8: Anomaly */
.anomaly-content {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.deviation-rows-scroll {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dev-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  background: rgba(9, 30, 66, 0.04);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.dev-row .dev-info {
  display: flex;
  flex-direction: column;
}

.dev-row .dev-info .name {
  font-size: 0.7rem;
  font-weight: 600;
}

.dev-row .dev-info .param {
  font-size: 0.6rem;
  color: var(--text-secondary);
}

.dev-badge-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dev-badge-wrapper .sigma-val {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--status-safe);
}

.dev-badge-wrapper .sigma-val.critical-sig {
  color: var(--status-critical);
}

.dev-badge-wrapper .badge-anom {
  font-size: 0.55rem;
  font-weight: 800;
  padding: 1px 3px;
  background: var(--status-critical);
  color: white;
  border-radius: 3px;
}

@keyframes flash-red {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

.flash-animation {
  animation: flash-red 1.2s infinite ease-in-out;
}

/* Styling for Master Setting Page */
.master-setting-page {
  padding: 24px;
  overflow-y: auto;
  height: calc(100vh - var(--header-height));
}

.settings-container {
  padding: 30px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.btn-save-settings {
  background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
  border: none;
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0, 210, 255, 0.25);
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-save-settings:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(0, 210, 255, 0.4);
}

.btn-save-settings:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.settings-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 30px;
  min-height: 480px;
}

.settings-tabs {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-right: 1px solid var(--border-color);
  padding-right: 20px;
}

.settings-tabs .tab-btn {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-secondary);
  padding: 12px 16px;
  border-radius: 8px;
  text-align: left;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
}

.settings-tabs .tab-btn:hover {
  background: rgba(0, 210, 255, 0.05);
  color: var(--accent-primary);
}

.settings-tabs .tab-btn.active {
  background: rgba(0, 210, 255, 0.1);
  border-color: var(--border-color);
  color: var(--accent-primary);
  box-shadow: 0 0 10px rgba(0, 210, 255, 0.05);
}

.settings-tab-content {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.logic-hint-block {
  background: rgba(0, 210, 255, 0.03);
  border: 1px dashed var(--border-color);
  padding: 16px;
  border-radius: 12px;
  font-size: 0.85rem;
  color: var(--text-primary);
  line-height: 1.5;
}

.logic-hint-block strong {
  color: var(--accent-primary);
  display: block;
  margin-bottom: 6px;
}

.logic-hint-block ul {
  margin-left: 20px;
  margin-top: 5px;
}

.logic-hint-block li {
  margin-bottom: 4px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  margin-top: 10px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.form-group input, .form-group select {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.9rem;
  width: 100%;
  max-width: 480px;
}

.form-group input:focus, .form-group select:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 8px rgba(0, 210, 255, 0.2);
}

.field-desc {
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* Math Renderer Styles */
.math-formula-block {
  background: rgba(255, 255, 255, 0.015);
  border: 1px solid rgba(0, 210, 255, 0.08);
  border-radius: 8px;
  padding: 14px 18px;
  margin: 12px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.math-equation {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
  color: var(--text-primary);
}

.math-var {
  color: var(--accent-primary);
  font-weight: 600;
  font-style: italic;
}

.math-symbol {
  color: var(--status-warning);
  font-weight: bold;
}

.math-fraction {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  vertical-align: middle;
  padding: 0 4px;
}

.math-fraction .numerator {
  border-bottom: 1px solid var(--text-primary);
  padding-bottom: 2px;
  text-align: center;
  width: 100%;
}

.math-fraction .denominator {
  padding-top: 2px;
  text-align: center;
  width: 100%;
}

.math-explanation {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-top: 4px;
  line-height: 1.6;
}

.math-explanation ul {
  list-style-type: none;
  padding-left: 0;
}

.math-explanation li {
  margin-bottom: 6px;
  position: relative;
  padding-left: 12px;
}

.math-explanation li::before {
  content: "•";
  color: var(--accent-primary);
  position: absolute;
  left: 0;
}
</style>
