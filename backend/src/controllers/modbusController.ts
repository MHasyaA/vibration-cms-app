import { Elysia, t } from "elysia";
import { ModbusConnectionService } from "../services/modbusConnectionService";
import { authPlugin, checkAdmin } from "../middlewares/auth";

const modbusConnectionService = new ModbusConnectionService();

export const modbusController = new Elysia({ prefix: "/modbus" })
  .use(authPlugin)

  // GET /api/modbus/connections - List all connections (Admin only)
  .get(
    "/connections",
    async ({ set }) => {
      try {
        const all = await modbusConnectionService.getAllConnections();
        return { success: true, data: all };
      } catch (error: any) {
        set.status = 500;
        return { success: false, message: error.message || "Gagal mengambil data koneksi" };
      }
    },
    { beforeHandle: (c: any) => checkAdmin(c) }
  )

  // POST /api/modbus/connections - Create new connection (Admin only)
  .post(
    "/connections",
    async ({ body, set }) => {
      try {
        const created = await modbusConnectionService.createConnection(body);
        set.status = 201;
        return { success: true, message: "Koneksi berhasil ditambahkan", data: created };
      } catch (error: any) {
        set.status = error.message.includes("sudah ada") ? 400 : 500;
        return { success: false, message: error.message || "Gagal membuat koneksi" };
      }
    },
    {
      beforeHandle: (c: any) => checkAdmin(c),
      body: t.Object({
        ipAddress: t.String({ minLength: 1 }),
        tcpPort: t.Optional(t.Integer({ minimum: 1 })),
        timeout: t.Optional(t.Integer({ minimum: 100 })),
        pollInterval: t.Optional(t.Integer({ minimum: 500 })),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  )

  // PUT /api/modbus/connections/:id - Update connection (Admin only)
  .put(
    "/connections/:id",
    async ({ params: { id }, body, set }) => {
      try {
        const connId = parseInt(id);
        if (isNaN(connId)) {
          set.status = 400;
          return { success: false, message: "ID tidak valid" };
        }
        const updated = await modbusConnectionService.updateConnection(connId, body);
        return { success: true, message: "Koneksi berhasil diperbarui", data: updated };
      } catch (error: any) {
        if (error.message.includes("tidak ditemukan")) set.status = 404;
        else if (error.message.includes("sudah digunakan")) set.status = 400;
        else set.status = 500;
        return { success: false, message: error.message || "Gagal memperbarui koneksi" };
      }
    },
    {
      beforeHandle: (c: any) => checkAdmin(c),
      body: t.Object({
        ipAddress: t.Optional(t.String({ minLength: 1 })),
        tcpPort: t.Optional(t.Integer({ minimum: 1 })),
        timeout: t.Optional(t.Integer({ minimum: 100 })),
        pollInterval: t.Optional(t.Integer({ minimum: 500 })),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  )

  // DELETE /api/modbus/connections/:id - Delete connection (Admin only)
  .delete(
    "/connections/:id",
    async ({ params: { id }, set }) => {
      try {
        const connId = parseInt(id);
        if (isNaN(connId)) {
          set.status = 400;
          return { success: false, message: "ID tidak valid" };
        }
        const deleted = await modbusConnectionService.deleteConnection(connId);
        return { success: true, message: "Koneksi berhasil dihapus", data: deleted };
      } catch (error: any) {
        set.status = error.message.includes("tidak ditemukan") ? 404 : 500;
        return { success: false, message: error.message || "Gagal menghapus koneksi" };
      }
    },
    { beforeHandle: (c: any) => checkAdmin(c) }
  )

  // GET /api/modbus/connections/:id/test - Test connection (Admin only)
  // Note: this is a dry-run check - returns config info since serial port testing
  // requires actual hardware. Polling service handles real connectivity.
  .get(
    "/connections/:id/test",
    async ({ params: { id }, set }) => {
      try {
        const connId = parseInt(id);
        if (isNaN(connId)) {
          set.status = 400;
          return { success: false, message: "ID tidak valid" };
        }
        const conn = await modbusConnectionService.getConnectionById(connId);
        if (!conn) {
          set.status = 404;
          return { success: false, message: "Koneksi tidak ditemukan" };
        }
        // Return config summary - actual port test requires hardware
        return {
          success: true,
          message: `Konfigurasi untuk ${conn.ipAddress}:${conn.tcpPort} valid. Koneksi aktual memerlukan gateway/device Modbus TCP.`,
          data: {
            ipAddress: conn.ipAddress,
            tcpPort: conn.tcpPort,
            pollInterval: conn.pollInterval,
            isActive: conn.isActive,
          },
        };
      } catch (error: any) {
        set.status = 500;
        return { success: false, message: error.message || "Gagal test koneksi" };
      }
    },
    { beforeHandle: (c: any) => checkAdmin(c) }
  );
