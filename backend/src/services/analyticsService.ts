import { db } from "../db/connection";
import { devices, sensorLogs, alarms } from "../db/schema";
import { sql, eq, desc } from "drizzle-orm";
import { SettingsService } from "./settingsService";

const settingsService = new SettingsService();

export class AnalyticsService {
  async getSummary() {
    // 0. Fetch dynamic settings
    const settings = await settingsService.getSettings();
    
    // Parse dynamic settings with fallback defaults
    const bobotWarningAlarm = parseFloat(settings.bobotWarningAlarm || "5");
    const bobotCriticalAlarm = parseFloat(settings.bobotCriticalAlarm || "15");
    const ambangKapasitasSistem = parseInt(settings.ambangKapasitasSistem || "5000000", 10);

    const pilihanKelasMesin = settings.pilihanKelasMesin || "Class I";
    const batasBawahZoneB = parseFloat(settings.batasBawahZoneB || "1.12");
    const batasBawahZoneC = parseFloat(settings.batasBawahZoneC || "2.80");
    const batasBawahZoneD = parseFloat(settings.batasBawahZoneD || "7.10");

    const jendelaWaktuBaseline = parseInt(settings.jendelaWaktuBaseline || "7", 10);
    const toleransiDeviasiMaksimal = parseFloat(settings.toleransiDeviasiMaksimal || "20");
    const sensitivitasDeteksiAnomali = settings.sensitivitasDeteksiAnomali || "Medium";

    const dataPointsRegression = parseInt(settings.dataPointsRegression || "14", 10);
    const thresholdKritisKegagalan = parseFloat(settings.thresholdKritisKegagalan || "7.10");
    const batasPeringatanHari = parseInt(settings.batasPeringatanHari || "15", 10);

    const metrikPengurutan = settings.metrikPengurutan || "alarmFrequency";
    const rentangWaktuEvaluasi = parseInt(settings.rentangWaktuEvaluasi || "168", 10);

    // 1. Fetch all devices
    const devicesList = await db.select().from(devices);
    const totalDevices = devicesList.length;

    // 2. Fetch all active alarms
    const activeAlarmsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(alarms)
      .where(eq(alarms.status, "active"));
    const totalActiveAlarms = activeAlarmsResult[0]?.count || 0;

    // 3. Fetch latest telemetry for each device
    const latestLogsQuery = sql`
      SELECT DISTINCT ON (sl.device_id)
        sl.id,
        sl.device_id as "deviceId",
        sl.temperature,
        sl.z_velocity as "zVelocity",
        sl.x_velocity as "xVelocity",
        sl.z_acceleration as "zAcceleration",
        sl.x_acceleration as "xAcceleration",
        sl.pressure,
        sl.flow,
        sl.level,
        sl.timestamp
      FROM ${sensorLogs} sl
      ORDER BY sl.device_id, sl.timestamp DESC
    `;
    const latestLogsResult = await db.execute(latestLogsQuery);
    const latestLogs = latestLogsResult.rows as any[];
    const latestLogsMap = new Map(latestLogs.map((row) => [row.deviceId, row]));

    // 4. Fetch sensor logs dynamically based on max configuration range required
    const maxDays = Math.max(jendelaWaktuBaseline, Math.ceil(rentangWaktuEvaluasi / 24), dataPointsRegression, 7);
    const databaseLogs = await db
      .select()
      .from(sensorLogs)
      .where(sql`timestamp >= NOW() - ${maxDays} * INTERVAL '1 day'`)
      .orderBy(desc(sensorLogs.timestamp));

    // Map log files by deviceId for quick access
    const logsByDevice = new Map<number, typeof sensorLogs.$inferSelect[]>();
    for (const log of databaseLogs) {
      if (!logsByDevice.has(log.deviceId)) {
        logsByDevice.set(log.deviceId, []);
      }
      logsByDevice.get(log.deviceId)!.push(log);
    }

    // =========================================================================
    // CARD A: OVERALL SYSTEM HEALTH SCORE & STATUS
    // =========================================================================
    const deviceStats = [];
    const complianceDetails = { zoneA: 0, zoneB: 0, zoneC: 0, zoneD: 0 };
    
    let warningCount = 0;
    let criticalCount = 0;

    for (const device of devicesList) {
      const tel = latestLogsMap.get(device.id);
      
      let status = "safe";

      if (tel) {
        const limits = {
          temperature: device.setpointTemp || 70,
          zVelocity: device.setpointZVel || 7.1,
          xVelocity: device.setpointXVel || 7.1,
          zAcceleration: device.setpointZAcc || 10,
          xAcceleration: device.setpointXAcc || 10,
          pressure: device.setpointPressure || 5.0,
          flow: device.setpointFlow || 50.0,
          level: device.setpointLevel || 800.0,
        };

        const readings = {
          temperature: tel.temperature,
          zVelocity: tel.zVelocity,
          xVelocity: tel.xVelocity,
          zAcceleration: tel.zAcceleration,
          xAcceleration: tel.xAcceleration,
          pressure: tel.pressure,
          flow: tel.flow,
          level: tel.level,
        };

        let isCritical = false;
        let isWarning = false;

        for (const [key, value] of Object.entries(readings)) {
          if (value === null || value === undefined) continue;
          const limit = (limits as any)[key];
          if (limit <= 0) continue;

          if (key === "level" || key === "pressure" || key === "flow") {
            if (value < limit) {
              isCritical = true;
            } else if (value < limit * 1.25) {
              isWarning = true;
            }
          } else {
            if (value >= limit) {
              isCritical = true;
            } else if (value >= limit * 0.8) {
              isWarning = true;
            }
          }
        }

        if (isCritical) {
          status = "critical";
          criticalCount++;
        } else if (isWarning) {
          status = "warning";
          warningCount++;
        }

        // =========================================================================
        // CARD B: ISO 10816 COMPLIANCE STATUS (Using dynamic config boundaries)
        // =========================================================================
        const maxVel = Math.max(tel.zVelocity || 0, tel.xVelocity || 0);
        if (maxVel < batasBawahZoneB) {
          complianceDetails.zoneA++;
        } else if (maxVel < batasBawahZoneC) {
          complianceDetails.zoneB++;
        } else if (maxVel < batasBawahZoneD) {
          complianceDetails.zoneC++;
        } else {
          complianceDetails.zoneD++;
        }
      } else {
        complianceDetails.zoneA++; // Default to good zone if no readings yet
      }

      deviceStats.push({
        deviceId: device.id,
        namaSensor: device.namaSensor,
        lokasi: device.lokasi,
        status,
      });
    }

    // Health score calculations using customized warning and critical deduct weights
    let healthScore = 100 - (warningCount * bobotWarningAlarm) - (criticalCount * bobotCriticalAlarm);
    if (healthScore < 0) healthScore = 0;
    healthScore = Math.round(healthScore);
    
    const compliantCount = complianceDetails.zoneA + complianceDetails.zoneB;
    const compliantPercentage = totalDevices > 0 ? Math.round((compliantCount / totalDevices) * 100) : 100;

    // =========================================================================
    // CARD C: ALARM FREQUENCY TREND (7 DAYS vs PREVIOUS 7 DAYS)
    // =========================================================================
    const alarmsList = await db
      .select()
      .from(alarms)
      .where(sql`timestamp >= NOW() - INTERVAL '14 days'`);

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const currentPeriodAlarms = alarmsList.filter((a) => new Date(a.timestamp) >= sevenDaysAgo);
    const previousPeriodAlarms = alarmsList.filter(
      (a) => new Date(a.timestamp) >= fourteenDaysAgo && new Date(a.timestamp) < sevenDaysAgo
    );

    const currentPeriodCount = currentPeriodAlarms.length;
    const previousPeriodCount = previousPeriodAlarms.length;

    let alarmTrendPercentage = 0;
    if (previousPeriodCount > 0) {
      alarmTrendPercentage = Math.round(((currentPeriodCount - previousPeriodCount) / previousPeriodCount) * 100);
    } else if (currentPeriodCount > 0) {
      alarmTrendPercentage = currentPeriodCount * 100;
    }

    // Build 7-day chronological history
    const dailyAlarms: { [key: string]: number } = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split("T")[0] || "";
      dailyAlarms[dateStr] = 0;
    }

    for (const a of currentPeriodAlarms) {
      const dateStr = new Date(a.timestamp).toISOString().split("T")[0] || "";
      if (dailyAlarms[dateStr] !== undefined) {
        dailyAlarms[dateStr]++;
      }
    }

    const alarmTrendHistory = Object.keys(dailyAlarms).map((date) => ({
      date,
      count: dailyAlarms[date],
    }));

    // =========================================================================
    // CARD D: TOP 3 WORST PERFORMERS & HIGH SEVERITY RATIOS
    // =========================================================================
    const worstPerformersList: any[] = [];
    const evalCutoff = new Date(Date.now() - rentangWaktuEvaluasi * 60 * 60 * 1000);
    const evalAlarms = alarmsList.filter((a) => new Date(a.timestamp) >= evalCutoff);

    for (const device of devicesList) {
      const tel = latestLogsMap.get(device.id);
      if (!tel) continue;

      const limits = {
        temperature: device.setpointTemp || 70,
        zVelocity: device.setpointZVel || 7.1,
        xVelocity: device.setpointXVel || 7.1,
        zAcceleration: device.setpointZAcc || 10,
        xAcceleration: device.setpointXAcc || 10,
        pressure: device.setpointPressure || 5.0,
        flow: device.setpointFlow || 50.0,
        level: device.setpointLevel || 800.0,
      };

      const readings = {
        temperature: tel.temperature || 0,
        zVelocity: tel.zVelocity || 0,
        xVelocity: tel.xVelocity || 0,
        zAcceleration: tel.zAcceleration || 0,
        xAcceleration: tel.xAcceleration || 0,
        pressure: tel.pressure || 0,
        flow: tel.flow || 0,
        level: tel.level || 0,
      };

      let maxRatio = 0;
      let worstParam = "";
      let worstVal = 0;
      let worstLimit = 0;

      for (const [key, value] of Object.entries(readings)) {
        const limit = (limits as any)[key];
        if (limit > 0) {
          let ratio = 0;
          if (key === "level") {
            ratio = value < limit ? ((limit - value) / limit) * 100 : 0;
          } else {
            ratio = (value / limit) * 100;
          }
          if (ratio > maxRatio) {
            maxRatio = ratio;
            worstParam = key;
            worstVal = value;
            worstLimit = limit;
          }
        }
      }

      // Calculate customized sorting metric score
      let sortingScore = 0;
      if (metrikPengurutan === "alarmFrequency") {
        sortingScore = evalAlarms.filter((a) => a.deviceId === device.id).length;
      } else if (metrikPengurutan === "baselineDeviation") {
        // Calculate highest deviation for sorting
        const devLogs = logsByDevice.get(device.id);
        if (devLogs && devLogs.length >= 3) {
          const baselineCutoff = new Date(Date.now() - jendelaWaktuBaseline * 24 * 60 * 60 * 1000);
          const baselineLogs = devLogs.filter((l) => new Date(l.timestamp) >= baselineCutoff);
          if (baselineLogs.length >= 3) {
            let maxZ = 0;
            const params = ["temperature", "zVelocity", "xVelocity", "zAcceleration", "xAcceleration"];
            for (const p of params) {
              const values = baselineLogs.map((l) => (l as any)[p] || 0);
              const sum = values.reduce((a, b) => a + b, 0);
              const mean = sum / values.length;
              const squareDiffs = values.map((v) => Math.pow(v - mean, 2));
              const variance = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
              const stdDev = Math.sqrt(variance);
              const latest = (tel as any)[p] || 0;
              const sigma = stdDev < 0.01 ? 0.01 : stdDev;
              const z = (latest - mean) / sigma;
              if (Math.abs(z) > Math.abs(maxZ)) maxZ = z;
            }
            sortingScore = Math.abs(maxZ);
          }
        }
      } else {
        // Default "peakVibration" (highest current ratio)
        sortingScore = maxRatio;
      }

      if (maxRatio >= 50) {
        worstPerformersList.push({
          deviceId: device.id,
          deviceName: device.namaSensor,
          parameter: worstParam,
          value: parseFloat(worstVal.toFixed(2)),
          limit: parseFloat(worstLimit.toFixed(2)),
          ratio: parseFloat(maxRatio.toFixed(1)),
          sortingScore: sortingScore,
        });
      }
    }

    worstPerformersList.sort((a, b) => b.sortingScore - a.sortingScore);
    const worstPerformers = worstPerformersList.slice(0, 3);

    // =========================================================================
    // CARD E: TIME TO MAINTENANCE (LINEAR REGRESSION PREDICTION)
    // =========================================================================
    const timeToMaintenance: any[] = [];

    for (const item of worstPerformersList) {
      const devLogs = logsByDevice.get(item.deviceId);
      if (!devLogs) continue;

      // Filter based on regression dynamic config range
      const regressionCutoff = new Date(Date.now() - dataPointsRegression * 24 * 60 * 60 * 1000);
      const regressionLogs = devLogs.filter((l) => new Date(l.timestamp) >= regressionCutoff);
      if (regressionLogs.length < 3) continue;

      // Filter and reverse so we have logs chronologically
      const chronoLogs = [...regressionLogs].reverse();
      const firstTime = new Date(chronoLogs[0]!.timestamp).getTime();

      // Extrapolate times into fractional days
      const x = chronoLogs.map((l) => (new Date(l.timestamp).getTime() - firstTime) / (1000 * 60 * 60 * 24));
      const y = chronoLogs.map((l) => (l as any)[item.parameter] || 0);

      const n = chronoLogs.length;
      const sumX = x.reduce((a, b) => a + b, 0);
      const sumY = y.reduce((a, b) => a + b, 0);
      const sumXY = x.reduce((sum, val, idx) => sum + val * y[idx], 0);
      const sumXX = x.reduce((sum, val) => sum + val * val, 0);

      const denominator = n * sumXX - sumX * sumX;
      if (denominator === 0) continue;

      const slope = (n * sumXY - sumX * sumY) / denominator; // Rate of change per day
      const intercept = (sumY - slope * sumX) / n;

      if (slope > 0) {
        const latestTime = x[x.length - 1];
        const latestVal = y[y.length - 1];
        
        // Days until reaching critical failure threshold configured
        const targetThreshold = item.parameter.toLowerCase().includes("velocity") ? thresholdKritisKegagalan : item.limit;
        const daysToLimit = (targetThreshold - latestVal) / slope;
        
        if (daysToLimit >= 0 && daysToLimit <= 120) {
          timeToMaintenance.push({
            deviceId: item.deviceId,
            deviceName: item.deviceName,
            parameter: item.parameter,
            estimatedDays: Math.round(daysToLimit),
            slope: parseFloat(slope.toFixed(4)),
            isCriticalWarning: Math.round(daysToLimit) < batasPeringatanHari,
          });
        }
      }
    }

    timeToMaintenance.sort((a, b) => a.estimatedDays - b.estimatedDays);

    // =========================================================================
    // CARD F: SELF-BASELINING DEVIATION (ANOMALY DETECTION)
    // =========================================================================
    const baseliningDeviations: any[] = [];
    
    let zThreshold = 3.0; // Default Medium Z-Score threshold
    if (sensitivitasDeteksiAnomali === "Low") zThreshold = 4.0;
    else if (sensitivitasDeteksiAnomali === "High") zThreshold = 2.0;

    for (const device of devicesList) {
      const tel = latestLogsMap.get(device.id);
      if (!tel) continue;

      const devLogs = logsByDevice.get(device.id);
      if (!devLogs) continue;

      // Filter baseline window based on dynamic settings
      const baselineCutoff = new Date(Date.now() - jendelaWaktuBaseline * 24 * 60 * 60 * 1000);
      const baselineLogs = devLogs.filter((l) => new Date(l.timestamp) >= baselineCutoff);
      if (baselineLogs.length < 5) continue;

      // Determine parameter with max deviation
      const params = ["temperature", "zVelocity", "xVelocity", "zAcceleration", "xAcceleration"];
      let maxZScore = 0;
      let targetParam = "";
      let targetLatest = 0;

      for (const p of params) {
        const values = baselineLogs.map((l) => (l as any)[p] || 0);
        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / values.length;
        const squareDiffs = values.map((v) => Math.pow(v - mean, 2));
        const variance = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
        const stdDev = Math.sqrt(variance);

        const latest = (tel as any)[p] || 0;
        const sigma = stdDev < 0.01 ? 0.01 : stdDev;
        const zScore = (latest - mean) / sigma;

        if (Math.abs(zScore) > Math.abs(maxZScore)) {
          maxZScore = zScore;
          targetParam = p;
          targetLatest = latest;
        }
      }

      if (targetParam) {
        baseliningDeviations.push({
          deviceId: device.id,
          deviceName: device.namaSensor,
          parameter: targetParam,
          deviation: parseFloat(maxZScore.toFixed(1)),
          isAnomaly: Math.abs(maxZScore) >= zThreshold,
        });
      }
    }

    return {
      totalDevices,
      totalActiveAlarms,
      healthScore,
      isoCompliance: {
        compliant: compliantCount,
        nonCompliant: totalDevices - compliantCount,
        compliantPercentage,
        ...complianceDetails,
      },
      alarmTrend: {
        percentage: alarmTrendPercentage,
        history: alarmTrendHistory,
      },
      worstPerformers,
      timeToMaintenance,
      baseliningDeviations,
      deviceStats,
    };
  }
}
