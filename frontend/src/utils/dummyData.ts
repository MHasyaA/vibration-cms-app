// =============================================================
// DUMMY DATA — Demo Mode untuk Vibration CMS
// Semua data bersifat simulasi, tidak masuk ke database.
// Dirancang agar calon klien bisa melihat SEMUA fitur aplikasi.
// =============================================================

// --- DUMMY MODBUS CONNECTIONS ---
export const DUMMY_MODBUS_CONNECTIONS = [
  {
    id: 1,
    name: "Gateway RS485-TCP Plant 1",
    host: "192.168.1.100",
    port: 502,
    isOnline: true,
    pollInterval: 3000,
    timeout: 1500,
    deviceCount: 3
  },
  {
    id: 2,
    name: "Gateway RS485-TCP Plant 2",
    host: "192.168.1.101",
    port: 502,
    isOnline: false,
    pollInterval: 3000,
    timeout: 1500,
    deviceCount: 2
  }
];

// --- DUMMY DEVICES (5 device, profil status bervariasi) ---
// connectionId mengacu ke DUMMY_MODBUS_CONNECTIONS di atas
export const DUMMY_DEVICES = [
  {
    id: 1,
    slaveId: 10,
    namaSensor: "Motor Pompa 3-Phase A",
    lokasi: "Plant 1 - Ruang Pompa",
    connectionId: 1,
    setpointTemp: 75.0,
    setpointZVel: 7.5,
    setpointXVel: 7.5,
    setpointZAcc: 12.0,
    setpointXAcc: 12.0
  },
  {
    id: 2,
    slaveId: 11,
    namaSensor: "Chiller Unit B",
    lokasi: "Plant 1 - Ruang Pendingin",
    connectionId: 1,
    setpointTemp: 65.0,
    setpointZVel: 5.0,
    setpointXVel: 5.0,
    setpointZAcc: 8.0,
    setpointXAcc: 8.0
  },
  {
    id: 3,
    slaveId: 12,
    namaSensor: "Compressor Utama",
    lokasi: "Plant 2 - Ruang Kompresor",
    connectionId: 2,
    setpointTemp: 85.0,
    setpointZVel: 9.0,
    setpointXVel: 9.0,
    setpointZAcc: 15.0,
    setpointXAcc: 15.0
  },
  {
    id: 4,
    slaveId: 13,
    namaSensor: "Cooling Tower Fan",
    lokasi: "Plant 1 - Rooftop",
    connectionId: 1,
    setpointTemp: 55.0,
    setpointZVel: 6.0,
    setpointXVel: 6.0,
    setpointZAcc: 10.0,
    setpointXAcc: 10.0
  },
  {
    id: 5,
    slaveId: 14,
    namaSensor: "Exhaust Fan Utilitas",
    lokasi: "Plant 2 - Utility Room",
    connectionId: 2,
    setpointTemp: 60.0,
    setpointZVel: 4.5,
    setpointXVel: 4.5,
    setpointZAcc: 7.0,
    setpointXAcc: 7.0
  }
];

// =============================================================
// TELEMETRI — Profil status per device:
//   Device 1 (Motor Pompa)    → SAFE
//   Device 2 (Chiller)        → WARNING (velocity mendekati limit)
//   Device 3 (Compressor)     → CRITICAL (velocity + temperature di atas setpoint → GETER + ASAP)
//   Device 4 (Cooling Tower)  → SAFE
//   Device 5 (Exhaust Fan)    → WARNING (temperature mendekati limit)
// =============================================================
export const generateDummyTelemetries = () => {
  const now = new Date().toISOString();
  const r = (base: number, spread: number) => base + (Math.random() * spread - spread / 2);

  return [
    // --- Device 1: SAFE ---
    {
      deviceId: 1,
      temperature: r(48, 3),           // 70% dari setpoint 75°C → aman
      zVelocity:   r(3.2, 0.4),        // 43% dari setpoint 7.5 mm/s → aman
      xVelocity:   r(2.8, 0.4),
      zAcceleration: r(5.0, 0.8),
      xAcceleration: r(4.5, 0.8),
      timestamp: now
    },
    // --- Device 2: WARNING (velocity ~80% setpoint) ---
    {
      deviceId: 2,
      temperature: r(47, 2),           // 72% dari setpoint 65°C → aman
      zVelocity:   r(4.1, 0.3),        // 82% dari setpoint 5.0 mm/s → WARNING
      xVelocity:   r(4.3, 0.3),        // 86% → WARNING
      zAcceleration: r(6.5, 0.5),      // 81% → WARNING
      xAcceleration: r(6.2, 0.5),
      timestamp: now
    },
    // --- Device 3: CRITICAL — velocity & temperature di atas setpoint (GETER + ASAP) ---
    {
      deviceId: 3,
      temperature: r(91, 2),           // >85°C setpoint → CRITICAL → SMOKE
      zVelocity:   r(10.5, 0.5),       // >9.0 setpoint → CRITICAL → SHAKE
      xVelocity:   r(9.8, 0.5),        // >9.0 → CRITICAL
      zAcceleration: r(17.5, 1.0),     // >15 → CRITICAL
      xAcceleration: r(16.2, 1.0),
      timestamp: now
    },
    // --- Device 4: SAFE ---
    {
      deviceId: 4,
      temperature: r(36, 2),
      zVelocity:   r(2.1, 0.3),
      xVelocity:   r(1.9, 0.3),
      zAcceleration: r(3.2, 0.5),
      xAcceleration: r(3.0, 0.5),
      timestamp: now
    },
    // --- Device 5: WARNING (temperature ~85% setpoint) ---
    {
      deviceId: 5,
      temperature: r(51.5, 1.5),       // 86% dari setpoint 60°C → WARNING
      zVelocity:   r(2.5, 0.3),        // 56% → SAFE
      xVelocity:   r(2.3, 0.3),
      zAcceleration: r(3.8, 0.4),
      xAcceleration: r(3.6, 0.4),
      timestamp: now
    }
  ];
};

// =============================================================
// ALARM AKTIF — 4 alarm dengan variasi parameter & severity
// =============================================================
export const DUMMY_ALARMS_ACTIVE = [
  {
    id: 301,
    deviceId: 3,
    deviceName: "Compressor Utama",
    parameter: "Velocity Z",
    value: 10.52,
    threshold: 9.0,
    status: "active",
    timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString()   // 12 menit lalu
  },
  {
    id: 302,
    deviceId: 3,
    deviceName: "Compressor Utama",
    parameter: "Temperature",
    value: 91.3,
    threshold: 85.0,
    status: "active",
    timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString()   // 18 menit lalu
  },
  {
    id: 303,
    deviceId: 2,
    deviceName: "Chiller Unit B",
    parameter: "Velocity X",
    value: 4.31,
    threshold: 5.0,
    status: "active",
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString()   // 45 menit lalu
  },
  {
    id: 304,
    deviceId: 5,
    deviceName: "Exhaust Fan Utilitas",
    parameter: "Temperature",
    value: 51.8,
    threshold: 60.0,
    status: "active",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()   // 2 jam lalu
  }
];

// =============================================================
// RIWAYAT ALARM — 12 entries spanning 7 hari terakhir
// =============================================================
const daysAgo = (d: number, h = 0) => new Date(Date.now() - d * 86400000 - h * 3600000).toISOString();
export const DUMMY_ALARMS_HISTORY = [
  { id: 200, deviceId: 1, deviceName: "Motor Pompa 3-Phase A",   parameter: "Temperature",    value: 76.5, threshold: 75.0,  status: "acknowledged", timestamp: daysAgo(0, 5) },
  { id: 201, deviceId: 3, deviceName: "Compressor Utama",        parameter: "Velocity Z",     value: 9.81, threshold: 9.0,   status: "acknowledged", timestamp: daysAgo(0, 8) },
  { id: 202, deviceId: 2, deviceName: "Chiller Unit B",          parameter: "Acceleration Z", value: 8.12, threshold: 8.0,   status: "acknowledged", timestamp: daysAgo(1, 2) },
  { id: 203, deviceId: 3, deviceName: "Compressor Utama",        parameter: "Temperature",    value: 88.4, threshold: 85.0,  status: "acknowledged", timestamp: daysAgo(1, 6) },
  { id: 204, deviceId: 5, deviceName: "Exhaust Fan Utilitas",    parameter: "Velocity X",     value: 4.60, threshold: 4.5,   status: "acknowledged", timestamp: daysAgo(2, 1) },
  { id: 205, deviceId: 4, deviceName: "Cooling Tower Fan",       parameter: "Temperature",    value: 56.3, threshold: 55.0,  status: "acknowledged", timestamp: daysAgo(2, 9) },
  { id: 206, deviceId: 1, deviceName: "Motor Pompa 3-Phase A",   parameter: "Velocity Z",     value: 7.62, threshold: 7.5,   status: "acknowledged", timestamp: daysAgo(3, 3) },
  { id: 207, deviceId: 3, deviceName: "Compressor Utama",        parameter: "Acceleration X", value: 16.1, threshold: 15.0,  status: "acknowledged", timestamp: daysAgo(3, 7) },
  { id: 208, deviceId: 2, deviceName: "Chiller Unit B",          parameter: "Temperature",    value: 66.0, threshold: 65.0,  status: "acknowledged", timestamp: daysAgo(4, 4) },
  { id: 209, deviceId: 5, deviceName: "Exhaust Fan Utilitas",    parameter: "Temperature",    value: 61.2, threshold: 60.0,  status: "acknowledged", timestamp: daysAgo(5, 2) },
  { id: 210, deviceId: 3, deviceName: "Compressor Utama",        parameter: "Velocity X",     value: 10.2, threshold: 9.0,   status: "acknowledged", timestamp: daysAgo(6, 1) },
  { id: 211, deviceId: 1, deviceName: "Motor Pompa 3-Phase A",   parameter: "Acceleration Z", value: 12.4, threshold: 12.0,  status: "acknowledged", timestamp: daysAgo(6, 8) },
];

// =============================================================
// TREND CHART — Dengan anomali spike di tengah agar grafik menarik
// =============================================================
export const generateDummyTrend = (deviceId: number, start?: string, end?: string) => {
  const trend = [];
  const endTime   = end   ? new Date(end).getTime()   : Date.now();
  const startTime = start ? new Date(start).getTime() : endTime - 6 * 60 * 60 * 1000; // default 6 jam

  const points   = 120;
  const interval = Math.max(1000, Math.floor((endTime - startTime) / points));

  const device = DUMMY_DEVICES.find(d => d.id === deviceId) || DUMMY_DEVICES[0];

  // Base values: 55% dari setpoint untuk semua, kecuali device 3 lebih tinggi
  const factor   = device.id === 3 ? 0.85 : device.id === 2 || device.id === 5 ? 0.70 : 0.55;
  const tempBase = device.setpointTemp  * factor;
  const velBase  = device.setpointZVel  * factor;
  const accBase  = device.setpointZAcc  * factor;

  // Spike zone: titik 40–60 dari 120 (sepertiga tengah grafik)
  const spikeStart = Math.floor(points * 0.38);
  const spikeEnd   = Math.floor(points * 0.62);

  for (let i = 0; i < points; i++) {
    const t = startTime + i * interval;

    // Hitung intensitas spike (bell curve)
    let spikeFactor = 0;
    if (i >= spikeStart && i <= spikeEnd) {
      const progress = (i - spikeStart) / (spikeEnd - spikeStart);
      // Parabola yang naik ke puncak di tengah
      spikeFactor = Math.sin(progress * Math.PI);
    }

    // Noise normal
    const noise = () => (Math.random() - 0.5) * 0.4;

    // Spike magnitude: cukup besar agar jelas di chart (melewati setpoint di puncak)
    const spikeMagTemp = device.setpointTemp * 0.35 * spikeFactor;
    const spikeMagVel  = device.setpointZVel * 0.55 * spikeFactor;
    const spikeMagAcc  = device.setpointZAcc * 0.45 * spikeFactor;

    trend.push({
      timestamp:     new Date(t).toISOString(),
      temperature:   +(tempBase + spikeMagTemp + Math.sin(i * 0.12) * 2 + noise()).toFixed(2),
      zVelocity:     +(velBase  + spikeMagVel  + Math.cos(i * 0.10) * 0.8 + noise()).toFixed(3),
      xVelocity:     +(velBase  + spikeMagVel  * 0.9 + Math.sin(i * 0.13) * 0.7 + noise()).toFixed(3),
      zAcceleration: +(accBase  + spikeMagAcc  + Math.cos(i * 0.08) * 1.2 + noise()).toFixed(3),
      xAcceleration: +(accBase  + spikeMagAcc  * 0.85 + Math.sin(i * 0.09) * 1.0 + noise()).toFixed(3),
    });
  }
  return trend;
};

// =============================================================
// ANALYTICS SUMMARY
// =============================================================
export const DUMMY_ANALYTICS_SUMMARY = {
  totalDevices:      DUMMY_DEVICES.length,
  totalActiveAlarms: DUMMY_ALARMS_ACTIVE.length,
  deviceStats: [
    { id: 1, name: "Motor Pompa 3-Phase A", status: 'safe'     },
    { id: 2, name: "Chiller Unit B",         status: 'warning'  },
    { id: 3, name: "Compressor Utama",       status: 'critical' },
    { id: 4, name: "Cooling Tower Fan",      status: 'safe'     },
    { id: 5, name: "Exhaust Fan Utilitas",   status: 'warning'  },
  ]
};
