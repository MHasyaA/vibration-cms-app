import { Elysia, t } from "elysia";
import { SettingsService } from "../services/settingsService";
import { authPlugin, checkAdmin, checkAuth } from "../middlewares/auth";

const settingsService = new SettingsService();

export const settingsController = new Elysia({ prefix: "/settings" })
  .use(authPlugin)
  
  // GET /api/settings - Fetch all settings (requires valid login)
  .get(
    "/",
    async ({ set }) => {
      try {
        const settings = await settingsService.getSettings();
        return {
          success: true,
          data: settings,
        };
      } catch (error: any) {
        set.status = 500;
        return {
          success: false,
          message: error.message || "Failed to fetch settings",
        };
      }
    },
    {
      beforeHandle: (c: any) => checkAuth(c),
    }
  )
  
  // PUT /api/settings - Update settings (requires admin role)
  .put(
    "/",
    async ({ body, set }) => {
      try {
        await settingsService.updateSettings(body as Record<string, string>);
        return {
          success: true,
          message: "Settings updated successfully",
        };
      } catch (error: any) {
        set.status = 500;
        return {
          success: false,
          message: error.message || "Failed to update settings",
        };
      }
    },
    {
      beforeHandle: (c: any) => checkAdmin(c),
      body: t.Record(t.String(), t.Union([t.String(), t.Number()])),
    }
  );
