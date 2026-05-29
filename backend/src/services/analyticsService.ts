import { db } from "../db/connection";
import { devices, sensorLogs, alarms } from "../db/schema";
import { sql, eq, desc } from "drizzle-orm";

export class AnalyticsService {
  async getSummary() {
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
        sl.timestamp
      FROM ${sensorLogs} sl
      ORDER BY sl.device_id, sl.timestamp DESC
    `;
    const latestLogsResult = await db.execute(latestLogsQuery);
    const latestLogs = latestLogsResult.rows as any[];
    const latestLogsMap = new Map(latestLogs.map((row) => [row.deviceId, row]));

    // 4. Fetch all sensor logs from the last 7 days for trend, linear regression, and baselining
    const sevenDaysLogs = await db
      .select()
      .from(sensorLogs)
      .where(sql`timestamp >= NOW() - INTERVAL '7 days'`)
      .orderBy(desc(sensorLogs.timestamp));

    // Map log files by deviceId for quick access
    const logsByDevice = new Map<number, typeof sensorLogs.$inferSelect[]>();
    for (const log of sevenDaysLogs) {
      if (!logsByDevice.has(log.deviceId)) {
        logsByDevice.set(log.deviceId, []);
      }
      logsByDevice.get(log.deviceId)!.push(log);
    }

    // =========================================================================
    // CARD A: OVERALL SYSTEM HEALTH SCORE & STATUS
    // =========================================================================
    let totalScore = 0;
    const deviceStats = [];
    const complianceDetails = { zoneA: 0, zoneB: 0, zoneC: 0, zoneD: 0 };

    for (const device of devicesList) {
      const tel = latestLogsMap.get(device.id);
      
      const tLimit = device.setpointTemp || 70;
      const zvLimit = device.setpointZVel || 7.1;
      const xvLimit = device.setpointXVel || 7.1;

      let status = "safe";
      let weight = 100;

      if (tel) {
        const t = tel.temperature || 0;
        const zv = tel.zVelocity || 0;
        const xv = tel.xVelocity || 0;

        if (t >= tLimit || zv >= zvLimit || xv >= xvLimit) {
          status = "critical";
          weight = 0;
        } else if (t >= tLimit * 0.8 || zv >= zvLimit * 0.7 || xv >= xvLimit * 0.7) {
          status = "warning";
          weight = 50;
        }

        // =========================================================================
        // CARD B: ISO 10816 COMPLIANCE STATUS
        // =========================================================================
        const maxVel = Math.max(zv, xv);
        if (maxVel < 1.8) {
          complianceDetails.zoneA++;
        } else if (maxVel < 4.5) {
          complianceDetails.zoneB++;
        } else if (maxVel < 7.1) {
          complianceDetails.zoneC++;
        } else {
          complianceDetails.zoneD++;
        }
      } else {
        complianceDetails.zoneA++; // Default to good zone if no readings yet
      }

      totalScore += weight;

      deviceStats.push({
        deviceId: device.id,
        namaSensor: device.namaSensor,
        lokasi: device.lokasi,
        status,
      });
    }

    const healthScore = totalDevices > 0 ? Math.round(totalScore / totalDevices) : 100;
    
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

    for (const device of devicesList) {
      const tel = latestLogsMap.get(device.id);
      if (!tel) continue;

      const limits = {
        temperature: device.setpointTemp || 70,
        zVelocity: device.setpointZVel || 7.1,
        xVelocity: device.setpointXVel || 7.1,
        zAcceleration: device.setpointZAcc || 10,
        xAcceleration: device.setpointXAcc || 10,
      };

      const readings = {
        temperature: tel.temperature || 0,
        zVelocity: tel.zVelocity || 0,
        xVelocity: tel.xVelocity || 0,
        zAcceleration: tel.zAcceleration || 0,
        xAcceleration: tel.xAcceleration || 0,
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

      if (maxRatio >= 50) {
        worstPerformersList.push({
          deviceId: device.id,
          deviceName: device.namaSensor,
          parameter: worstParam,
          value: parseFloat(worstVal.toFixed(2)),
          limit: parseFloat(worstLimit.toFixed(2)),
          ratio: parseFloat(maxRatio.toFixed(1)),
        });
      }
    }

    worstPerformersList.sort((a, b) => b.ratio - a.ratio);
    const worstPerformers = worstPerformersList.slice(0, 3);

    // =========================================================================
    // CARD E: TIME TO MAINTENANCE (LINEAR REGRESSION PREDICTION)
    // =========================================================================
    const timeToMaintenance: any[] = [];

    for (const item of worstPerformersList) {
      const devLogs = logsByDevice.get(item.deviceId);
      if (!devLogs || devLogs.length < 3) continue;

      // Filter and reverse so we have logs chronologically
      const chronoLogs = [...devLogs].reverse();
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
        
        // Days until reaching limit
        const daysToLimit = (item.limit - latestVal) / slope;
        
        if (daysToLimit >= 0 && daysToLimit <= 120) {
          timeToMaintenance.push({
            deviceId: item.deviceId,
            deviceName: item.deviceName,
            parameter: item.parameter,
            estimatedDays: Math.round(daysToLimit),
            slope: parseFloat(slope.toFixed(4)),
          });
        }
      }
    }

    timeToMaintenance.sort((a, b) => a.estimatedDays - b.estimatedDays);

    // =========================================================================
    // CARD F: SELF-BASELINING DEVIATION (ANOMALY DETECTION)
    // =========================================================================
    const baseliningDeviations: any[] = [];

    for (const device of devicesList) {
      const tel = latestLogsMap.get(device.id);
      if (!tel) continue;

      const devLogs = logsByDevice.get(device.id);
      if (!devLogs || devLogs.length < 5) continue;

      // Determine parameter with max deviation
      const params = ["temperature", "zVelocity", "xVelocity", "zAcceleration", "xAcceleration"];
      let maxZScore = 0;
      let targetParam = "";
      let targetLatest = 0;

      for (const p of params) {
        const values = devLogs.map((l) => (l as any)[p] || 0);
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
          isAnomaly: Math.abs(maxZScore) >= 3.0,
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

