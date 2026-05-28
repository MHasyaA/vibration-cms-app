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
        const { modbusPollingService } = await import("../services/modbusPollingService");
        const states = modbusPollingService.getConnectionStates();
        const enriched = all.map((conn: any) => ({
          ...conn,
          isOnline: conn.isActive ? (states.get(conn.id)?.isOnline ?? false) : false,
        }));
        return { success: true, data: enriched };
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
  // Connects to Modbus TCP and attempts a single register read to verify connectivity.
  .get(
    "/connections/:id/test",
    async ({ params: { id } }) => {
      try {
        const connId = parseInt(id);
        if (isNaN(connId)) {
          return { success: false, message: "ID tidak valid" };
        }
        const conn = await modbusConnectionService.getConnectionById(connId);
        if (!conn) {
          return { success: false, message: "Koneksi tidak ditemukan" };
        }

        // Uji coba koneksi aktif menggunakan modbus-serial
        let ModbusRTU: any;
        try {
          const modbusModuleName = "modbus-serial";
          const mod = await import(modbusModuleName);
          ModbusRTU = mod.default;
        } catch {
          return {
            success: false,
            message: "Library 'modbus-serial' tidak terinstall di backend.",
          };
        }

        const client = new ModbusRTU();
        try {
          client.setTimeout(2000);
          await client.connectTCP(conn.ipAddress, { port: conn.tcpPort });

          const devices = await modbusConnectionService.getDevicesByConnectionId(connId);
          let readVal: number | null = null;
          let testMessage = "";

          if (devices.length > 0) {
            // Temukan device yang memiliki setidaknya satu register terkonfigurasi
            const activeDev = devices.find(
              (d) => d.regTemp !== null || d.regZVel !== null || d.regXVel !== null
            );

            if (activeDev) {
              client.setID(activeDev.slaveId);
              const regAddr =
                activeDev.regTemp !== null
                  ? activeDev.regTemp
                  : activeDev.regZVel !== null
                  ? activeDev.regZVel
                  : activeDev.regXVel;

              if (regAddr !== null) {
                const dataType = activeDev.regDataType || "float32";
                const byteOrder = activeDev.regByteOrder || "BE";
                const regsPerValue = dataType === "float32" ? 2 : 1;

                const result = await client.readHoldingRegisters(regAddr, regsPerValue);
                const buf = Buffer.from(result.buffer);

                if (dataType === "float32") {
                  readVal = byteOrder === "BE" ? buf.readFloatBE(0) : buf.readFloatLE(0);
                } else if (dataType === "uint16") {
                  readVal = byteOrder === "BE" ? buf.readUInt16BE(0) : buf.readUInt16LE(0);
                } else {
                  readVal = byteOrder === "BE" ? buf.readInt16BE(0) : buf.readInt16LE(0);
                }

                if (readVal === 0) {
                  testMessage = `Terhubung ke ${conn.ipAddress}:${conn.tcpPort} (Slave #${activeDev.slaveId}). Data register ${regAddr} bernilai 0 (Pastikan register terisi data).`;
                } else {
                  testMessage = `Terhubung ke ${conn.ipAddress}:${conn.tcpPort} (Slave #${activeDev.slaveId}). Sukses membaca register ${regAddr} = ${readVal.toFixed(2)}.`;
                }
              } else {
                // Device ada tapi semua regAddress null, baca default 0
                client.setID(activeDev.slaveId);
                const result = await client.readHoldingRegisters(0, 1);
                readVal = result.data[0];
                testMessage = `Terhubung ke ${conn.ipAddress}:${conn.tcpPort} (Slave #${activeDev.slaveId}). Alamat register belum di-map, sukses membaca default register 0 = ${readVal}.`;
              }
            } else {
              // Jika device ada tapi register belum di-map, baca register 0 default unit 1
              client.setID(1);
              const result = await client.readHoldingRegisters(0, 1);
              readVal = result.data[0];
              testMessage = `Terhubung ke ${conn.ipAddress}:${conn.tcpPort} (Slave #1). Sukses membaca default register 0 = ${readVal}.`;
            }
          } else {
            // Jika tidak ada device terdaftar, baca register 0 default unit 1
            client.setID(1);
            const result = await client.readHoldingRegisters(0, 1);
            readVal = result.data[0];
            testMessage = `Terhubung ke ${conn.ipAddress}:${conn.tcpPort} (Slave #1). Sukses membaca default register 0 = ${readVal}.`;
          }

          await client.close();
          return {
            success: true,
            message: testMessage,
            data: { value: readVal },
          };
        } catch (err: any) {
          try {
            await client.close();
          } catch {}

          let errorMsg = err.message || "Gagal menghubungi device";
          if (errorMsg.includes("ECONNREFUSED")) {
            errorMsg = "Koneksi ditolak (Connection Refused). Pastikan IP dan Port simulator Modbus TCP sudah benar dan sedang berjalan.";
          } else if (errorMsg.includes("ETIMEDOUT") || errorMsg.includes("timeout")) {
            errorMsg = "Koneksi habis waktu (Timeout). Pastikan IP, Port, dan rute jaringan ke simulator sudah benar.";
          } else if (errorMsg.includes("EHOSTUNREACH")) {
            errorMsg = "Host tidak dapat dijangkau. Periksa sambungan jaringan dan IP Address Anda.";
          }

          return {
            success: false,
            message: errorMsg,
          };
        }
      } catch (error: any) {
        return { success: false, message: error.message || "Gagal test koneksi" };
      }
    },
    { beforeHandle: (c: any) => checkAdmin(c) }
  );
