CREATE TABLE "alarms" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"parameter" text NOT NULL,
	"value" double precision NOT NULL,
	"threshold" double precision NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"slave_id" integer NOT NULL,
	"nama_sensor" text NOT NULL,
	"lokasi" text NOT NULL,
	"setpoint_temp" double precision DEFAULT 0 NOT NULL,
	"setpoint_z_vel" double precision DEFAULT 0 NOT NULL,
	"setpoint_x_vel" double precision DEFAULT 0 NOT NULL,
	"setpoint_z_acc" double precision DEFAULT 0 NOT NULL,
	"setpoint_x_acc" double precision DEFAULT 0 NOT NULL,
	"connection_id" integer,
	"reg_temp" integer,
	"reg_z_vel" integer,
	"reg_x_vel" integer,
	"reg_z_acc" integer,
	"reg_x_acc" integer,
	"reg_data_type" text DEFAULT 'float32',
	"reg_byte_order" text DEFAULT 'BE',
	CONSTRAINT "devices_slave_id_unique" UNIQUE("slave_id")
);
--> statement-breakpoint
CREATE TABLE "modbus_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"port_name" text NOT NULL,
	"baud_rate" integer DEFAULT 9600 NOT NULL,
	"data_bits" integer DEFAULT 8 NOT NULL,
	"stop_bits" integer DEFAULT 1 NOT NULL,
	"parity" text DEFAULT 'none' NOT NULL,
	"timeout" integer DEFAULT 1000 NOT NULL,
	"poll_interval" integer DEFAULT 5000 NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "modbus_connections_port_name_unique" UNIQUE("port_name")
);
--> statement-breakpoint
CREATE TABLE "sensor_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"temperature" double precision NOT NULL,
	"z_velocity" double precision NOT NULL,
	"x_velocity" double precision NOT NULL,
	"z_acceleration" double precision NOT NULL,
	"x_acceleration" double precision NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "vibration_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"sensor_name" text NOT NULL,
	"vibration_value" double precision NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alarms" ADD CONSTRAINT "alarms_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_connection_id_modbus_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."modbus_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensor_logs" ADD CONSTRAINT "sensor_logs_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;