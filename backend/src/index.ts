import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { vibrationController } from "./controllers/vibrationController";
import { deviceController } from "./controllers/deviceController";
import { alarmController } from "./controllers/alarmController";
import { dataController } from "./controllers/dataController";
import { analyticsController } from "./controllers/analyticsController";
import { modbusController } from "./controllers/modbusController";
import { UserService } from "./services/userService";
import { authPlugin } from "./middlewares/auth";
import { modbusPollingService } from "./services/modbusPollingService";

const userService = new UserService();

// Seed default users at startup if table is empty
userService.seedDefaultUsers().catch((err) => {
  console.error("Failed to seed default users:", err);
});

const app = new Elysia()
  .use(cors())
  .use(authPlugin) // Register authPlugin globally
  .group("/api", (app) => 
    app
      .use(vibrationController)
      .use(deviceController)
      .use(alarmController)
      .use(dataController)
      .use(analyticsController)
      .use(modbusController)
  )
  .listen({ port: 3000, hostname: "0.0.0.0" });


console.log(
  `🦊 Elysia backend is running at ${app.server?.hostname}:${app.server?.port}`
);

// Phase #4: Start Modbus polling service on startup
// Will gracefully skip if no active connections or if modbus-serial is not installed
modbusPollingService.startAll().catch((err) => {
  console.error("[Modbus] Failed to start polling service:", err);
});

