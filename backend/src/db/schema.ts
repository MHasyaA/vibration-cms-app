import { pgTable, serial, text, doublePrecision, timestamp, integer, boolean } from "drizzle-orm/pg-core";

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

// Phase #4: Modbus Serial Connection Config
// One connection (one RS485 bus/COM port) can serve multiple devices (slaves)
export const modbusConnections = pgTable("modbus_connections", {
  id: serial("id").primaryKey(),
  portName: text("port_name").notNull().unique(), // e.g. "COM3", "/dev/ttyUSB0"
  baudRate: integer("baud_rate").notNull().default(9600), // 9600, 19200, 38400, 115200
  dataBits: integer("data_bits").notNull().default(8), // 7 or 8
  stopBits: integer("stop_bits").notNull().default(1), // 1 or 2
  parity: text("parity").notNull().default("none"), // 'none' | 'even' | 'odd'
  timeout: integer("timeout").notNull().default(1000), // ms
  pollInterval: integer("poll_interval").notNull().default(5000), // ms
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ModbusConnection = typeof modbusConnections.$inferSelect;
export type NewModbusConnection = typeof modbusConnections.$inferInsert;

// Phase #1: Device Manager API
// Phase #4 additions: connectionId (FK) and register address mapping (all nullable for backward compat)
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
  // Phase #4: Modbus configuration (nullable - device works without modbus config)
  connectionId: integer("connection_id").references(() => modbusConnections.id, { onDelete: "set null" }),
  regTemp: integer("reg_temp"), // Holding register address for Temperature
  regZVel: integer("reg_z_vel"), // Register address for Z-Velocity
  regXVel: integer("reg_x_vel"), // Register address for X-Velocity
  regZAcc: integer("reg_z_acc"), // Register address for Z-Acceleration
  regXAcc: integer("reg_x_acc"), // Register address for X-Acceleration
  regDataType: text("reg_data_type").default("float32"), // 'int16' | 'uint16' | 'float32'
  regByteOrder: text("reg_byte_order").default("BE"), // 'BE' | 'LE'
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

