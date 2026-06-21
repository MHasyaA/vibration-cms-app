import { Elysia, t } from "elysia";
import { DataService } from "../services/dataService";
import { authPlugin, checkAuth, checkAdmin } from "../middlewares/auth";

const dataService = new DataService();

export const dataController = new Elysia({ prefix: "/data" })
  // Use authPlugin to derive 'user' context on all routes
  .use(authPlugin)
  
  // GET /api/data/realtime - Latest readings for all devices
  .get(
    "/realtime",
    async ({ set }) => {
      try {
        const data = await dataService.getRealtimeData();
        
        // Periksa status runtime koneksi Modbus TCP
        const { modbusPollingService } = await import("../services/modbusPollingService");
        const states = modbusPollingService.getConnectionStates();
        
        // Ambil daftar semua device untuk mencocokkan deviceId -> connectionId
        const { DeviceService } = await import("../services/deviceService");
        const deviceService = new DeviceService();
        const allDevices = await deviceService.getAllDevices();
        
        const deviceConnMap = new Map<number, number | null>();
        allDevices.forEach((d: any) => {
          deviceConnMap.set(d.id, d.connectionId);
        });

        const enrichedData = data.map((item: any) => {
          const connId = deviceConnMap.get(item.deviceId);
          const isOnline = connId ? (states.get(connId)?.isOnline ?? false) : false;
          
          if (!isOnline) {
            // Jika koneksi Modbus offline, jadikan seluruh data telemetri null (kosong)
            return {
              ...item,
              temperature: null,
              zVelocity: null,
              xVelocity: null,
              zAcceleration: null,
              xAcceleration: null,
              pressure: null,
              flow: null,
              level: null,
            };
          }
          return item;
        });

        return {
          success: true,
          data: enrichedData,
        };
      } catch (error: any) {
        set.status = 500;
        return {
          success: false,
          message: error.message || "Failed to fetch realtime data",
        };
      }
    },
    {
      beforeHandle: (c: any) => checkAuth(c),
    }
  )
  
  // GET /api/data/trend - Historical logs with filter
  .get(
    "/trend",
    async ({ query, set }) => {
      try {
        const deviceId = parseInt(query.deviceId);
        if (isNaN(deviceId)) {
          set.status = 400;
          return { success: false, message: "Invalid deviceId" };
        }
        
        const logs = await dataService.getTrendData(
          deviceId,
          query.start,
          query.end
        );
        
        return {
          success: true,
          data: logs,
        };
      } catch (error: any) {
        set.status = 500;
        return {
          success: false,
          message: error.message || "Failed to fetch trend data",
        };
      }
    },
    {
      beforeHandle: (c: any) => checkAuth(c),
      query: t.Object({
        deviceId: t.String({ minLength: 1 }), // Sent as string in query params
        start: t.Optional(t.String()),
        end: t.Optional(t.String()),
      }),
    }
  )
  
  // POST /api/data/simulate - Ingest mock data (Admin-only)
  .post(
    "/simulate",
    async ({ body, set }) => {
      try {
        const result = await dataService.insertSensorLog(body);
        return {
          success: true,
          message: "Data simulated and recorded successfully",
          data: result.log,
          alarmsTriggered: result.alarms,
        };
      } catch (error: any) {
        set.status = error.message.includes("does not exist") ? 400 : 500;
        return {
          success: false,
          message: error.message || "Failed to simulate data",
        };
      }
    },
    {
      beforeHandle: (c: any) => checkAdmin(c),
      body: t.Object({
        deviceId: t.Integer(),
        temperature: t.Number(),
        zVelocity: t.Number(),
        xVelocity: t.Number(),
        zAcceleration: t.Number(),
        xAcceleration: t.Number(),
        pressure: t.Number(),
        flow: t.Number(),
        level: t.Number(),
      }),
    }
  );
