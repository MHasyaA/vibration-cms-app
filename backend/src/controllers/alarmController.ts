import { Elysia, t } from "elysia";
import { AlarmService } from "../services/alarmService";
import { authPlugin, checkAuth } from "../middlewares/auth";

const alarmService = new AlarmService();

export const alarmController = new Elysia({ prefix: "/alarms" })
  // Use authPlugin to derive 'user' context on all routes
  .use(authPlugin)
  
  // GET /api/alarms - Fetch active or history of alarms
  .get(
    "/",
    async ({ query, set }) => {
      try {
        const statusFilter = query.status as "active" | "acknowledged" | undefined;
        const list = await alarmService.getAllAlarms(statusFilter);
        return {
          success: true,
          data: list,
        };
      } catch (error: any) {
        set.status = 500;
        return {
          success: false,
          message: error.message || "Failed to fetch alarms",
        };
      }
    },
    {
      beforeHandle: (c: any) => checkAuth(c),
      query: t.Object({
        status: t.Optional(t.Union([t.Literal("active"), t.Literal("acknowledged")])),
      }),
    }
  )
  
  
  // PUT /api/alarms/acknowledge-all - Confirm/Acknowledge all alarms
  .put(
    "/acknowledge-all",
    async () => {
      try {
        const updated = await alarmService.acknowledgeAllAlarms();
        return {
          success: true,
          message: "All alarms acknowledged successfully",
          data: updated,
        };
      } catch (error: any) {
        return {
          success: false,
          message: error.message || "Failed to acknowledge all alarms",
        };
      }
    },
    {
      beforeHandle: (c: any) => checkAuth(c),
    }
  )

  // PUT /api/alarms/:id/acknowledge - Confirm/Acknowledge an alarm
  .put(
    "/:id/acknowledge",
    async ({ params: { id }, set }) => {
      try {
        const alarmId = parseInt(id);
        if (isNaN(alarmId)) {
          set.status = 400;
          return { success: false, message: "Invalid Alarm ID format" };
        }
        
        const updated = await alarmService.acknowledgeAlarm(alarmId);
        return {
          success: true,
          message: "Alarm acknowledged successfully",
          data: updated,
        };
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return {
          success: false,
          message: error.message || "Failed to acknowledge alarm",
        };
      }
    },
    {
      beforeHandle: (c: any) => checkAuth(c),
    }
  );
