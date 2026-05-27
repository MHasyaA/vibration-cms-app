import { Elysia } from "elysia";
import { UserService } from "../services/userService";

const userService = new UserService();

// Global plugin that parses the Basic Auth header and mutably populates context.user
export const authPlugin = new Elysia({ name: "authPlugin" })
  .derive(() => ({
    user: null as { id: number; username: string; role: string } | null,
  }))
  .onBeforeHandle({ as: "global" }, async (context: any) => {
    const authHeader = context.request.headers.get("authorization");
    
    context.user = null; // Initialize/Default to unauthorized

    if (!authHeader || !authHeader.startsWith("Basic ")) {
      return;
    }

    try {
      const base64Credentials = authHeader.substring(6);
      const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
      const parts = credentials.split(":");
      const username = parts[0];
      const password = parts.slice(1).join(":"); // Handle passwords that contain colons

      if (!username || !password) {
        return;
      }

      const user = await userService.findByUsername(username);
      if (!user) {
        return;
      }

      const isValid = await Bun.password.verify(password, user.password);
      if (isValid) {
        context.user = {
          id: user.id,
          username: user.username,
          role: user.role, // 'admin' | 'user'
        };
      }
    } catch (error: any) {
      console.error(`[authPlugin] Error in global auth hook:`, error.message);
    }
  });

// Helper hook to enforce authentication (any role)
export const checkAuth = ({ user, set }: any) => {
  if (!user) {
    set.status = 401;
    set.headers["www-authenticate"] = 'Basic realm="Vibration CMS"';
    return {
      success: false,
      message: "Unauthorized",
    };
  }
};

// Helper hook to enforce admin role
export const checkAdmin = ({ user, set }: any) => {
  if (!user) {
    set.status = 401;
    set.headers["www-authenticate"] = 'Basic realm="Vibration CMS"';
    return {
      success: false,
      message: "Unauthorized",
    };
  }
  if (user.role !== "admin") {
    set.status = 403;
    return {
      success: false,
      message: "Forbidden: Admin access required",
    };
  }
};


