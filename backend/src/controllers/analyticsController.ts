import { Elysia } from "elysia";
import { AnalyticsService } from "../services/analyticsService";
import { authPlugin, checkAuth } from "../middlewares/auth";

const analyticsService = new AnalyticsService();

export const analyticsController = new Elysia({ prefix: "/analytics" })
  // Use authPlugin to derive 'user' context on all routes
  .use(authPlugin)
  
  // GET /api/analytics/summary - Get overall and per-device analytics
  .get(
    "/summary",
    async ({ set }) => {
      try {
        const summary = await analyticsService.getSummary();
        return {
          success: true,
          data: summary,
        };
      } catch (error: any) {
        set.status = 500;
        return {
          success: false,
          message: error.message || "Failed to fetch analytics summary",
        };
      }
    },
    {
      beforeHandle: (c: any) => checkAuth(c),
    }
  );
