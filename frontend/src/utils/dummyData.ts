export const DUMMY_DEVICES = [
  {
    id: 1,
    slaveId: 10,
    namaSensor: "Motor Pompa 3-Phase A",
    lokasi: "Plant 1",
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
    lokasi: "Plant 1",
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
    lokasi: "Plant 2",
    setpointTemp: 85.0,
    setpointZVel: 9.0,
    setpointXVel: 9.0,
    setpointZAcc: 15.0,
    setpointXAcc: 15.0
  }
];

export const generateDummyTelemetries = () => {
  return DUMMY_DEVICES.map(device => {
    // Generate realistic fluctuating values
    const tempBase = device.setpointTemp * 0.7;
    const velBase = device.setpointZVel * 0.6;
    const accBase = device.setpointZAcc * 0.5;

    return {
      deviceId: device.id,
      temperature: tempBase + (Math.random() * 5 - 2.5),
      zVelocity: velBase + (Math.random() * 2 - 1),
      xVelocity: velBase + (Math.random() * 2 - 1),
      zAcceleration: accBase + (Math.random() * 3 - 1.5),
      xAcceleration: accBase + (Math.random() * 3 - 1.5),
      timestamp: new Date().toISOString()
    };
  });
};

export const DUMMY_ALARMS_ACTIVE = [
  {
    id: 101,
    deviceId: 3,
    deviceName: "Compressor Utama",
    parameter: "Velocity Z",
    value: 9.5,
    threshold: 9.0,
    status: "active",
    timestamp: new Date(Date.now() - 500000).toISOString()
  }
];

export const DUMMY_ALARMS_HISTORY = [
  {
    id: 100,
    deviceId: 1,
    deviceName: "Motor Pompa 3-Phase A",
    parameter: "Temperature",
    value: 76.5,
    threshold: 75.0,
    status: "acknowledged",
    timestamp: new Date(Date.now() - 86400000).toISOString() // 1 day ago
  }
];

export const generateDummyTrend = (deviceId: number, limit: number = 30) => {
  const trend = [];
  const now = Date.now();
  const device = DUMMY_DEVICES.find(d => d.id === deviceId) || DUMMY_DEVICES[0];

  const tempBase = device.setpointTemp * 0.6;
  const velBase = device.setpointZVel * 0.5;
  const accBase = device.setpointZAcc * 0.4;

  for (let i = limit; i >= 0; i--) {
    trend.push({
      timestamp: new Date(now - i * 5000).toISOString(),
      temperature: tempBase + (Math.sin(i * 0.5) * 5) + (Math.random() * 2),
      zVelocity: velBase + (Math.cos(i * 0.3) * 2) + (Math.random() * 0.5),
      xVelocity: velBase + (Math.sin(i * 0.4) * 2) + (Math.random() * 0.5),
      zAcceleration: accBase + (Math.cos(i * 0.2) * 3) + (Math.random() * 1),
      xAcceleration: accBase + (Math.sin(i * 0.25) * 3) + (Math.random() * 1)
    });
  }
  return trend;
};

export const DUMMY_ANALYTICS_SUMMARY = {
  totalDevices: DUMMY_DEVICES.length,
  totalActiveAlarms: DUMMY_ALARMS_ACTIVE.length,
  deviceStats: DUMMY_DEVICES.map(d => ({
    id: d.id,
    name: d.namaSensor,
    status: d.id === 3 ? 'critical' : 'safe'
  }))
};
