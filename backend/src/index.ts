import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { vibrationController } from "./controllers/vibrationController";

const app = new Elysia()
  .use(cors())
  .group("/api", (app) => app.use(vibrationController))
  .listen({ port: 3000, hostname: "0.0.0.0" });

console.log(
  `🦊 Elysia backend is running at ${app.server?.hostname}:${app.server?.port}`
);
