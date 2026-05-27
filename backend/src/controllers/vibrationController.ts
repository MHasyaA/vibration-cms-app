import { Elysia, t } from "elysia";
import { VibrationService } from "../services/vibrationService";

const vibrationService = new VibrationService();

export const vibrationController = new Elysia({ prefix: "/vibration" })
  .post(
    "/",
    async ({ body, set }) => {
      try {
        const { sensorName, vibrationValue } = body;
        const result = await vibrationService.saveVibrationData(sensorName, vibrationValue);
        set.status = 201;
        return {
          success: true,
          message: "Vibration data recorded successfully",
          data: result,
        };
      } catch (error: any) {
        set.status = 500;
        return {
          success: false,
          message: error.message || "Internal server error",
        };
      }
    },
    {
      body: t.Object({
        sensorName: t.String(),
        vibrationValue: t.Number(),
      }),
    }
  )
  .get("/", async ({ query, set }) => {
    try {
      const limit = query.limit ? parseInt(query.limit) : 50;
      const history = await vibrationService.getVibrationHistory(limit);
      return {
        success: true,
        data: history,
      };
    } catch (error: any) {
      set.status = 500;
      return {
        success: false,
        message: error.message || "Internal server error",
      };
    }
  });
