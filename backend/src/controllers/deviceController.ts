import { Elysia, t } from "elysia";
import { DeviceService } from "../services/deviceService";
import { authPlugin, checkAuth, checkAdmin } from "../middlewares/auth";

const deviceService = new DeviceService();

export const deviceController = new Elysia({ prefix: "/devices" })
  // Use authPlugin to derive 'user' context on all routes
  .use(authPlugin)
  
  // GET /api/devices - List all devices (Authenticated user or admin)
  .get(
    "/",
    async ({ set }) => {
      try {
        const allDevices = await deviceService.getAllDevices();
        return {
          success: true,
          data: allDevices,
        };
      } catch (error: any) {
        set.status = 500;
        return {
          success: false,
          message: error.message || "Failed to fetch devices",
        };
      }
    },
    {
      beforeHandle: (c: any) => checkAuth(c),
    }
  )
  
  // POST /api/devices - Add new device (Admin only)
  .post(
    "/",
    async ({ body, set }) => {
      try {
        const newDevice = await deviceService.createDevice(body);
        const { modbusPollingService } = await import("../services/modbusPollingService");
        modbusPollingService.restartAll().catch((err) => console.error("[Modbus] Failed to restart polling:", err));
        set.status = 201;
        return {
          success: true,
          message: "Device created successfully",
          data: newDevice,
        };
      } catch (error: any) {
        set.status = error.message.includes("already exists") ? 400 : 500;
        return {
          success: false,
          message: error.message || "Failed to create device",
        };
      }
    },
    {
      beforeHandle: (c: any) => checkAdmin(c),
      body: t.Object({
        slaveId: t.Integer({ minimum: 1, maximum: 247 }),
        namaSensor: t.String({ minLength: 1 }),
        lokasi: t.String({ minLength: 1 }),
        setpointTemp: t.Optional(t.Number()),
        setpointZVel: t.Optional(t.Number()),
        setpointXVel: t.Optional(t.Number()),
        setpointZAcc: t.Optional(t.Number()),
        setpointXAcc: t.Optional(t.Number()),
        // Phase #4: Modbus config
        connectionId: t.Optional(t.Nullable(t.Integer())),
        regTemp: t.Optional(t.Nullable(t.Integer({ minimum: 0 }))),
        regZVel: t.Optional(t.Nullable(t.Integer({ minimum: 0 }))),
        regXVel: t.Optional(t.Nullable(t.Integer({ minimum: 0 }))),
        regZAcc: t.Optional(t.Nullable(t.Integer({ minimum: 0 }))),
        regXAcc: t.Optional(t.Nullable(t.Integer({ minimum: 0 }))),
        regDataType: t.Optional(t.String()),
        regByteOrder: t.Optional(t.String()),
        scaleTemp: t.Optional(t.Nullable(t.Number())),
        scaleZVel: t.Optional(t.Nullable(t.Number())),
        scaleXVel: t.Optional(t.Nullable(t.Number())),
        scaleZAcc: t.Optional(t.Nullable(t.Number())),
        scaleXAcc: t.Optional(t.Nullable(t.Number())),
      }),
    }
  )
  
  // PUT /api/devices/:id - Update device (Admin only)
  .put(
    "/:id",
    async ({ params: { id }, body, set }) => {
      try {
        const deviceId = parseInt(id);
        if (isNaN(deviceId)) {
          set.status = 400;
          return { success: false, message: "Invalid Device ID format" };
        }
        
        const updated = await deviceService.updateDevice(deviceId, body);
        const { modbusPollingService } = await import("../services/modbusPollingService");
        modbusPollingService.restartAll().catch((err) => console.error("[Modbus] Failed to restart polling:", err));
        return {
          success: true,
          message: "Device updated successfully",
          data: updated,
        };
      } catch (error: any) {
        if (error.message.includes("not found")) {
          set.status = 404;
        } else if (error.message.includes("already exists")) {
          set.status = 400;
        } else {
          set.status = 500;
        }
        return {
          success: false,
          message: error.message || "Failed to update device",
        };
      }
    },
    {
      beforeHandle: (c: any) => checkAdmin(c),
      body: t.Object({
        slaveId: t.Optional(t.Integer({ minimum: 1, maximum: 247 })),
        namaSensor: t.Optional(t.String({ minLength: 1 })),
        lokasi: t.Optional(t.String({ minLength: 1 })),
        setpointTemp: t.Optional(t.Number()),
        setpointZVel: t.Optional(t.Number()),
        setpointXVel: t.Optional(t.Number()),
        setpointZAcc: t.Optional(t.Number()),
        setpointXAcc: t.Optional(t.Number()),
        // Phase #4: Modbus config
        connectionId: t.Optional(t.Nullable(t.Integer())),
        regTemp: t.Optional(t.Nullable(t.Integer({ minimum: 0 }))),
        regZVel: t.Optional(t.Nullable(t.Integer({ minimum: 0 }))),
        regXVel: t.Optional(t.Nullable(t.Integer({ minimum: 0 }))),
        regZAcc: t.Optional(t.Nullable(t.Integer({ minimum: 0 }))),
        regXAcc: t.Optional(t.Nullable(t.Integer({ minimum: 0 }))),
        regDataType: t.Optional(t.Nullable(t.String())),
        regByteOrder: t.Optional(t.Nullable(t.String())),
        scaleTemp: t.Optional(t.Nullable(t.Number())),
        scaleZVel: t.Optional(t.Nullable(t.Number())),
        scaleXVel: t.Optional(t.Nullable(t.Number())),
        scaleZAcc: t.Optional(t.Nullable(t.Number())),
        scaleXAcc: t.Optional(t.Nullable(t.Number())),
      }),
    }
  )
  
  // DELETE /api/devices/:id - Delete device (Admin only)
  .delete(
    "/:id",
    async ({ params: { id }, set }) => {
      try {
        const deviceId = parseInt(id);
        if (isNaN(deviceId)) {
          set.status = 400;
          return { success: false, message: "Invalid Device ID format" };
        }
        
        const deleted = await deviceService.deleteDevice(deviceId);
        const { modbusPollingService } = await import("../services/modbusPollingService");
        modbusPollingService.restartAll().catch((err) => console.error("[Modbus] Failed to restart polling:", err));
        return {
          success: true,
          message: "Device deleted successfully",
          data: deleted,
        };
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return {
          success: false,
          message: error.message || "Failed to delete device",
        };
      }
    },
    {
      beforeHandle: (c: any) => checkAdmin(c),
    }
  );
