import { db } from "../db/connection";
import { devices, sensorLogs, alarms } from "../db/schema";
import { sql, eq } from "drizzle-orm";

export class AnalyticsService {
  async getSummary() {
    // 1. Total devices
    const deviceCountResult = await db.select({ count: sql<number>`count(*)::int` }).from(devices);
    const totalDevices = deviceCountResult[0]?.count || 0;

    // 2. Total active alarms
    const activeAlarmsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(alarms)
      .where(eq(alarms.status, "active"));
    const totalActiveAlarms = activeAlarmsResult[0]?.count || 0;

    // 3. Aggregate metrics per device for the last 7 days
    const metricsQuery = sql`
      SELECT 
        d.id as "deviceId",
        d.nama_sensor as "namaSensor",
        d.lokasi as "lokasi",
        COALESCE(MAX(sl.temperature), 0)::double precision as "maxTemp",
        COALESCE(AVG(sl.temperature), 0)::double precision as "avgTemp",
        COALESCE(MAX(sl.z_velocity), 0)::double precision as "maxZVel",
        COALESCE(AVG(sl.z_velocity), 0)::double precision as "avgZVel",
        COALESCE(MAX(sl.x_velocity), 0)::double precision as "maxXVel",
        COALESCE(AVG(sl.x_velocity), 0)::double precision as "avgXVel",
        COALESCE(MAX(sl.z_acceleration), 0)::double precision as "maxZAcc",
        COALESCE(AVG(sl.z_acceleration), 0)::double precision as "avgZAcc",
        COALESCE(MAX(sl.x_acceleration), 0)::double precision as "maxXAcc",
        COALESCE(AVG(sl.x_acceleration), 0)::double precision as "avgXAcc",
        COUNT(sl.id)::int as "logCount"
      FROM ${devices} d
      LEFT JOIN ${sensorLogs} sl ON d.id = sl.device_id AND sl.timestamp >= NOW() - INTERVAL '7 days'
      GROUP BY d.id, d.nama_sensor, d.lokasi
      ORDER BY d.id
    `;

    const metricsResult = await db.execute(metricsQuery);

    // 4. Count of active alarms per device
    const alarmCountsQuery = sql`
      SELECT 
        device_id as "deviceId",
        COUNT(id)::int as "activeAlarmCount"
      FROM ${alarms}
      WHERE status = 'active'
      GROUP BY device_id
    `;

    const alarmCountsResult = await db.execute(alarmCountsQuery);
    const alarmCountsMap = new Map(
      alarmCountsResult.rows.map((row: any) => [row.deviceId, row.activeAlarmCount])
    );

    // Merge active alarm counts into the metrics summary
    const deviceStats = metricsResult.rows.map((row: any) => {
      const activeAlarmCount = alarmCountsMap.get(row.deviceId) || 0;
      return {
        ...row,
        activeAlarmCount,
      };
    });

    return {
      totalDevices,
      totalActiveAlarms,
      deviceStats,
    };
  }
}
