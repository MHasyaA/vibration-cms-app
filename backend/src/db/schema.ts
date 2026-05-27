import { pgTable, serial, text, doublePrecision, timestamp } from "drizzle-orm/pg-core";

export const vibrationLogs = pgTable("vibration_logs", {
  id: serial("id").primaryKey(),
  sensorName: text("sensor_name").notNull(),
  vibrationValue: doublePrecision("vibration_value").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type VibrationLog = typeof vibrationLogs.$inferSelect;
export type NewVibrationLog = typeof vibrationLogs.$inferInsert;
