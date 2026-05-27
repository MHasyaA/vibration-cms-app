import { db } from "../db/connection";
import { sensorLogs, devices } from "../db/schema";
import { AlarmService } from "./alarmService";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

const alarmService = new AlarmService();

export class DataService {
  // Saves a new sensor log and evaluates alarm conditions immediately
  async insertSensorLog(data: {
    deviceId: number;
    temperature: number;
    zVelocity: number;
    xVelocity: number;
    zAcceleration: number;
    xAcceleration: number;
  }) {
    // 1. Check if device exists
    const [device] = await db
      .select()
      .from(devices)
      .where(eq(devices.id, data.deviceId))
      .limit(1);
    
    if (!device) {
      throw new Error(`Device with ID ${data.deviceId} does not exist`);
    }

    // 2. Insert the log
    const [newLog] = await db.insert(sensorLogs).values(data).returning();

    // 3. Trigger alarm check in the background
    // We await it here so we can see triggered alarms in the simulator response
    const triggeredAlarms = await alarmService.checkAndTriggerAlarms(data.deviceId, {
      temperature: data.temperature,
      zVelocity: data.zVelocity,
      xVelocity: data.xVelocity,
      zAcceleration: data.zAcceleration,
      xAcceleration: data.xAcceleration,
    });

    return {
      log: newLog,
      alarms: triggeredAlarms,
    };
  }

  // Gets the single most recent log for each registered device
  // Uses PostgreSQL's high-performance SELECT DISTINCT ON syntax
  async getRealtimeData() {
    const query = sql`
      SELECT DISTINCT ON (sl.device_id)
        sl.id,
        sl.device_id as "deviceId",
        sl.temperature,
        sl.z_velocity as "zVelocity",
        sl.x_velocity as "xVelocity",
        sl.z_acceleration as "zAcceleration",
        sl.x_acceleration as "xAcceleration",
        sl.timestamp,
        d.nama_sensor as "namaSensor",
        d.lokasi as "lokasi"
      FROM ${sensorLogs} sl
      JOIN ${devices} d ON sl.device_id = d.id
      ORDER BY sl.device_id, sl.timestamp DESC
    `;

    const result = await db.execute(query);
    return result.rows;
  }

  // Gets historical sensor logs for trend analysis
  async getTrendData(deviceId: number, start?: string, end?: string) {
    const conditions = [eq(sensorLogs.deviceId, deviceId)];

    if (start) {
      conditions.push(gte(sensorLogs.timestamp, new Date(start)));
    }
    if (end) {
      conditions.push(lte(sensorLogs.timestamp, new Date(end)));
    }

    return await db
      .select()
      .from(sensorLogs)
      .where(and(...conditions))
      .orderBy(desc(sensorLogs.timestamp))
      .limit(500); // Guard rails to prevent large payloads
  }
}
