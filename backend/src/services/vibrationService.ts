import { db } from "../db/connection";
import { vibrationLogs } from "../db/schema";
import { desc } from "drizzle-orm";

export class VibrationService {
  async saveVibrationData(sensorName: string, vibrationValue: number) {
    const [inserted] = await db.insert(vibrationLogs).values({
      sensorName,
      vibrationValue,
    }).returning();
    return inserted;
  }

  async getVibrationHistory(limit: number = 50) {
    return await db.query.vibrationLogs.findMany({
      orderBy: [desc(vibrationLogs.timestamp)],
      limit,
    });
  }
}
