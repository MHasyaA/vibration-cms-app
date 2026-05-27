import { pgTable, serial, text, doublePrecision, timestamp, integer } from "drizzle-orm/pg-core";

// Phase #0 compatibility
export const vibrationLogs = pgTable("vibration_logs", {
  id: serial("id").primaryKey(),
  sensorName: text("sensor_name").notNull(),
  vibrationValue: doublePrecision("vibration_value").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type VibrationLog = typeof vibrationLogs.$inferSelect;
export type NewVibrationLog = typeof vibrationLogs.$inferInsert;

// Phase #1: User API
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull(), // 'admin' | 'user'
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// Phase #1: Device Manager API
export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  slaveId: integer("slave_id").notNull().unique(),
  namaSensor: text("nama_sensor").notNull(),
  lokasi: text("lokasi").notNull(),
  setpointTemp: doublePrecision("setpoint_temp").notNull().default(0),
  setpointZVel: doublePrecision("setpoint_z_vel").notNull().default(0),
  setpointXVel: doublePrecision("setpoint_x_vel").notNull().default(0),
  setpointZAcc: doublePrecision("setpoint_z_acc").notNull().default(0),
  setpointXAcc: doublePrecision("setpoint_x_acc").notNull().default(0),
});

export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;

// Phase #1: Sensor Logs API (Trend & Realtime)
export const sensorLogs = pgTable("sensor_logs", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  temperature: doublePrecision("temperature").notNull(),
  zVelocity: doublePrecision("z_velocity").notNull(),
  xVelocity: doublePrecision("x_velocity").notNull(),
  zAcceleration: doublePrecision("z_acceleration").notNull(),
  xAcceleration: doublePrecision("x_acceleration").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type SensorLog = typeof sensorLogs.$inferSelect;
export type NewSensorLog = typeof sensorLogs.$inferInsert;

// Phase #1: Alarm API
export const alarms = pgTable("alarms", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  parameter: text("parameter").notNull(), // 'temperature' | 'zVelocity' | 'xVelocity' | 'zAcceleration' | 'xAcceleration'
  value: doublePrecision("value").notNull(),
  threshold: doublePrecision("threshold").notNull(),
  status: text("status").notNull().default("active"), // 'active' | 'acknowledged'
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type Alarm = typeof alarms.$inferSelect;
export type NewAlarm = typeof alarms.$inferInsert;

