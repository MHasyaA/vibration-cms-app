import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { vibrationController } from "./controllers/vibrationController";
import { deviceController } from "./controllers/deviceController";
import { alarmController } from "./controllers/alarmController";
import { dataController } from "./controllers/dataController";
import { analyticsController } from "./controllers/analyticsController";
import { UserService } from "./services/userService";
import { authPlugin } from "./middlewares/auth";

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
  )
  .listen({ port: 3000, hostname: "0.0.0.0" });


console.log(
  `🦊 Elysia backend is running at ${app.server?.hostname}:${app.server?.port}`
);

