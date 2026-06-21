import { db } from "../db/connection";
import { alarms, devices } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";

export class AlarmService {
  async getAllAlarms(status?: "active" | "acknowledged") {
    const baseQuery = db
      .select({
        id: alarms.id,
        deviceId: alarms.deviceId,
        parameter: alarms.parameter,
        value: alarms.value,
        threshold: alarms.threshold,
        status: alarms.status,
        timestamp: alarms.timestamp,
        deviceName: devices.namaSensor,
      })
      .from(alarms)
      .leftJoin(devices, eq(alarms.deviceId, devices.id));

    if (status) {
      return await baseQuery
        .where(eq(alarms.status, status))
        .orderBy(desc(alarms.timestamp));
    }

    return await baseQuery.orderBy(desc(alarms.timestamp));
  }

  async acknowledgeAlarm(id: number) {
    const [updated] = await db
      .update(alarms)
      .set({ status: "acknowledged" })
      .where(eq(alarms.id, id))
      .returning();
    
    if (!updated) {
      throw new Error(`Alarm with ID ${id} not found`);
    }
    
    return updated;
  }

  async acknowledgeAllAlarms() {
    return await db
      .update(alarms)
      .set({ status: "acknowledged" })
      .where(eq(alarms.status, "active"))
      .returning();
  }

  // Evaluates a new sensor log reading against configured device setpoints.
  // Triggers/records alarms when a threshold is breached, preventing duplicate active alarms.
  async checkAndTriggerAlarms(
    deviceId: number,
    readings: {
      temperature: number;
      zVelocity: number;
      xVelocity: number;
      zAcceleration: number;
      xAcceleration: number;
      pressure: number;
      flow: number;
      level: number;
    }
  ) {
    // 1. Fetch the device setpoints
    const [device] = await db
      .select()
      .from(devices)
      .where(eq(devices.id, deviceId))
      .limit(1);
    
    if (!device) return [];

    const breaches: { parameter: string; value: number; threshold: number }[] = [];

    // Helper to check standard threshold breaches
    const checkBreach = (paramName: string, currentValue: number, setpoint: number) => {
      // If setpoint is 0, we treat it as disabled/no-limit
      if (setpoint <= 0) return;
      
      if (paramName === "level" || paramName === "pressure" || paramName === "flow") {
        if (currentValue < setpoint) {
          breaches.push({
            parameter: paramName,
            value: currentValue,
            threshold: setpoint,
          });
        }
      } else {
        if (currentValue > setpoint) {
          breaches.push({
            parameter: paramName,
            value: currentValue,
            threshold: setpoint,
          });
        }
      }
    };

    checkBreach("temperature", readings.temperature, device.setpointTemp);
    checkBreach("zVelocity", readings.zVelocity, device.setpointZVel);
    checkBreach("xVelocity", readings.xVelocity, device.setpointXVel);
    checkBreach("zAcceleration", readings.zAcceleration, device.setpointZAcc);
    checkBreach("xAcceleration", readings.xAcceleration, device.setpointXAcc);
    checkBreach("pressure", readings.pressure, device.setpointPressure);
    checkBreach("flow", readings.flow, device.setpointFlow);
    checkBreach("level", readings.level, device.setpointLevel);

    const triggeredAlarms = [];

    for (const breach of breaches) {
      const [newAlarm] = await db
        .insert(alarms)
        .values({
          deviceId,
          parameter: breach.parameter,
          value: breach.value,
          threshold: breach.threshold,
          status: "active",
        })
        .returning();
      
      triggeredAlarms.push(newAlarm);
      console.log(`[ALARM TRIGGERED] Device ID ${deviceId} breached ${breach.parameter}: ${breach.value} > ${breach.threshold}`);
    }

    return triggeredAlarms;
  }
}
