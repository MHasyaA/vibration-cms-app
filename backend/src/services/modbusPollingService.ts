import { ModbusConnectionService } from "./modbusConnectionService";
import { DeviceService } from "./deviceService";
import { DataService } from "./dataService";

const modbusConnectionService = new ModbusConnectionService();
const deviceService = new DeviceService();
const dataService = new DataService();

// Type for a parsed sensor data reading
interface SensorReading {
  temperature: number;
  zVelocity: number;
  xVelocity: number;
  zAcceleration: number;
  xAcceleration: number;
  pressure: number;
  flow: number;
  level: number;
}

/**
 * ModbusPollingService
 *
 * Manages Modbus RTU connections and periodic sensor polling.
 * Each active modbusConnection spawns one interval that sequentially reads
 * all associated devices (slaves) on that RS485 bus.
 *
 * NOTE: Requires 'modbus-serial' npm package and physical RS485 hardware.
 * Without hardware, set isActive = false on connections to skip polling.
 * Install with: bun add modbus-serial
 */
export class ModbusPollingService {
  // Map of connectionId -> ModbusRTU client instance
  private clients: Map<number, any> = new Map();
  // Map of connectionId -> interval timer
  private timers: Map<number, Timer> = new Map();
  // Map of connectionId -> runtime connection status
  private connectionStates: Map<number, { isOnline: boolean; lastSuccess?: Date }> = new Map();
  // Track overlapping polling cycles
  private pollingActive: Map<number, boolean> = new Map();
  // Track if the service has been started
  private isRunning = false;

  getConnectionStates() {
    return this.connectionStates;
  }

  /**
   * Start polling for all active connections in the database.
   * Called once at backend startup.
   */
  async startAll() {
    if (this.isRunning) {
      console.log("[Modbus] Service already running, skipping startAll");
      return;
    }

    let ModbusRTU: any;
    try {
      // Dynamic import using a string variable to bypass static analysis errors
      const modbusModuleName = "modbus-serial";
      const mod = await import(modbusModuleName);
      ModbusRTU = mod.default;
    } catch {
      console.warn("[Modbus] 'modbus-serial' package not installed. Run 'bun add modbus-serial' to enable hardware polling.");
      console.warn("[Modbus] Polling service will NOT start. Set isActive=false on all connections to suppress this warning.");
      return;
    }

    const activeConnections = await modbusConnectionService.getActiveConnections();

    if (activeConnections.length === 0) {
      console.log("[Modbus] No active connections configured. Polling not started.");
      return;
    }

    console.log(`[Modbus] Starting polling for ${activeConnections.length} active connection(s)...`);

    for (const conn of activeConnections) {
      this.startPolling(conn, ModbusRTU).catch((err) => {
        console.error(`[Modbus] Error in startPolling for connection ${conn.id}:`, err);
      });
    }

    this.isRunning = true;
  }

  /**
   * Start polling for a single connection.
   */
  private async startPolling(connection: any, ModbusRTU: any) {
    const client = new ModbusRTU();

    try {
      client.setTimeout(connection.timeout || 2000);
      const connectionTimeout = connection.timeout || 2000;
      
      await new Promise<void>((resolve, reject) => {
        let timer = setTimeout(() => {
          timer = null as any;
          try {
            if (client._port && client._port._client && typeof client._port._client.destroy === "function") {
              client._port._client.destroy();
            } else if (client._client && typeof client._client.destroy === "function") {
              client._client.destroy();
            }
          } catch {}
          reject(new Error("TCP Connection Timed Out"));
        }, connectionTimeout);

        client.connectTCP(connection.ipAddress, { port: connection.tcpPort })
          .then(() => {
            if (timer) {
              clearTimeout(timer);
              resolve();
            }
          })
          .catch((err: any) => {
            if (timer) {
              clearTimeout(timer);
              reject(err);
            }
          });
      });

      this.clients.set(connection.id, client);
      console.log(`[Modbus] Connected to Modbus TCP @ ${connection.ipAddress}:${connection.tcpPort}`);
    } catch (err: any) {
      this.connectionStates.set(connection.id, { isOnline: false });
      console.error(`[Modbus] Initial connection failed to ${connection.ipAddress}:${connection.tcpPort}:`, err.message);
      try {
        if (client._port && client._port._client && typeof client._port._client.destroy === "function") {
          client._port._client.destroy();
        } else if (client._client && typeof client._client.destroy === "function") {
          client._client.destroy();
        }
        client.close().catch(() => {});
      } catch {}
      // Jangan return, tetap jalankan interval timer agar bisa reconnect otomatis
    }

    const timer = setInterval(async () => {
      await this.pollConnection(connection.id, connection);
    }, connection.pollInterval);

    this.timers.set(connection.id, timer);
    console.log(`[Modbus] Polling started for Modbus TCP at ${connection.ipAddress}:${connection.tcpPort} every ${connection.pollInterval}ms`);
  }

  /**
   * Execute one polling cycle for a connection: read all its devices sequentially.
   */
  private async pollConnection(connectionId: number, connection: any) {
    if (this.pollingActive.get(connectionId)) {
      return; // Lewati jika siklus polling sebelumnya masih berjalan
    }
    this.pollingActive.set(connectionId, true);

    try {
      await this.executePollCycle(connectionId, connection);
    } finally {
      this.pollingActive.set(connectionId, false);
    }
  }

  private async executePollCycle(connectionId: number, connection: any) {
    let client = this.clients.get(connectionId);

    // Jika client belum terbuat atau koneksi terputus (isOpen = false), coba reconnect
    if (!client || !client.isOpen) {
      let ModbusRTU: any;
      try {
        const modbusModuleName = "modbus-serial";
        const mod = await import(modbusModuleName);
        ModbusRTU = mod.default;
      } catch {
        this.connectionStates.set(connectionId, { isOnline: false });
        return;
      }

      // Selalu bersihkan dan hancurkan client lama untuk menghindari zombie TCP sockets
      if (client) {
        try {
          if (client._port && client._port._client && typeof client._port._client.destroy === "function") {
            client._port._client.destroy();
          } else if (client._client && typeof client._client.destroy === "function") {
            client._client.destroy();
          }
          client.close().catch(() => {});
        } catch {}
        this.clients.delete(connectionId);
      }

      // Instansiasi client bersih baru
      client = new ModbusRTU();

      try {
        client.setTimeout(connection.timeout || 2000);
        const connectionTimeout = connection.timeout || 2000;

        await new Promise<void>((resolve, reject) => {
          let timer = setTimeout(() => {
            timer = null as any;
            try {
              if (client._port && client._port._client && typeof client._port._client.destroy === "function") {
                client._port._client.destroy();
              } else if (client._client && typeof client._client.destroy === "function") {
                client._client.destroy();
              }
            } catch {}
            reject(new Error("TCP Connection Timed Out"));
          }, connectionTimeout);

          client.connectTCP(connection.ipAddress, { port: connection.tcpPort })
            .then(() => {
              if (timer) {
                clearTimeout(timer);
                resolve();
              }
            })
            .catch((err: any) => {
              if (timer) {
                clearTimeout(timer);
                reject(err);
              }
            });
        });

        this.clients.set(connectionId, client);
        console.log(`[Modbus] Reconnected to Modbus TCP @ ${connection.ipAddress}:${connection.tcpPort}`);
      } catch (err: any) {
        this.connectionStates.set(connectionId, { isOnline: false });
        console.error(`[Modbus] Reconnection failed to ${connection.ipAddress}:${connection.tcpPort}:`, err.message);
        try {
          if (client._port && client._port._client && typeof client._port._client.destroy === "function") {
            client._port._client.destroy();
          } else if (client._client && typeof client._client.destroy === "function") {
            client._client.destroy();
          }
          client.close().catch(() => {});
        } catch {}
        this.clients.delete(connectionId);
        return; // Lewati poll cycle kali ini
      }
    }

    try {
      const connectedDevices = await deviceService.getDevicesByConnectionId(connectionId);
      let successfulReads = 0;
      let totalDevicesWithRegs = 0;

      for (const device of connectedDevices) {
        // Skip devices that don't have register mapping configured
        if (
          device.regTemp === null &&
          device.regZVel === null &&
          device.regPressure === null &&
          device.regFlow === null &&
          device.regLevel === null
        ) {
          continue;
        }
        totalDevicesWithRegs++;

        try {
          client.setID(device.slaveId);
          const reading = await this.readDeviceRegisters(client, device);
          await dataService.insertSensorLog({ deviceId: device.id, ...reading });
          successfulReads++;
        } catch (err: any) {
          console.error(`[Modbus] Read failed on ${connection.ipAddress}:${connection.tcpPort}: ${err.message}`);
          
          // Jika terjadi error koneksi socket closed atau timeout, putuskan client agar reconnect pada cycle berikutnya
          const errMsg = (err.message || "").toLowerCase();
          if (
            errMsg.includes("closed") || 
            errMsg.includes("lost") || 
            errMsg.includes("port") || 
            errMsg.includes("connection") || 
            errMsg.includes("refused") || 
            errMsg.includes("econnreset") || 
            errMsg.includes("reset") || 
            errMsg.includes("pipe") || 
            errMsg.includes("host") || 
            errMsg.includes("unreach")
          ) {
            try {
              if (client._port && client._port._client && typeof client._port._client.destroy === "function") {
                client._port._client.destroy();
              } else if (client._client && typeof client._client.destroy === "function") {
                client._client.destroy();
              }
              client.close().catch(() => {});
            } catch {}
            this.clients.delete(connectionId);
            this.connectionStates.set(connectionId, { isOnline: false });
            return; // Putuskan cycle ini langsung agar tidak berulang kali memicu error port mati
          }
        }
      }

      // Mark the connection state based on reads
      if (totalDevicesWithRegs > 0) {
        if (successfulReads === 0) {
          this.connectionStates.set(connectionId, { isOnline: false });
        } else {
          this.connectionStates.set(connectionId, { isOnline: true, lastSuccess: new Date() });
        }
      } else {
        // Jika tidak ada device terdaftar, anggap online jika koneksi TCP terbuka
        const isOpen = client && client.isOpen;
        this.connectionStates.set(connectionId, { isOnline: !!isOpen, lastSuccess: isOpen ? new Date() : undefined });
      }
    } catch (err: any) {
      this.connectionStates.set(connectionId, { isOnline: false });
      console.error(`[Modbus] Error during poll cycle for connectionId ${connectionId}:`, err.message);
    }
  }

  /**
   * Read all 8 parameters from a device's holding registers.
   * Supports int16, uint16, and float32 data types with BE/LE byte order.
   */
  private async readDeviceRegisters(client: any, device: any): Promise<SensorReading> {
    const dataType = device.regDataType || "float32";
    const byteOrder = device.regByteOrder || "BE";

    // float32 uses 2 registers per value, int16/uint16 uses 1 register per value
    const regsPerValue = dataType === "float32" ? 2 : 1;

    async function readParam(
      regAddr: number | null,
      scale: number | null | undefined,
      offset?: number | null | undefined,
      useDivisorFormula = false
    ): Promise<number> {
      if (regAddr === null || regAddr === undefined) return 0;
      const result = await client.readHoldingRegisters(regAddr, regsPerValue);
      const buf = Buffer.from(result.buffer);
      let rawVal = 0;
      if (dataType === "float32") {
        rawVal = byteOrder === "BE" ? buf.readFloatBE(0) : buf.readFloatLE(0);
      } else if (dataType === "uint16") {
        rawVal = byteOrder === "BE" ? buf.readUInt16BE(0) : buf.readUInt16LE(0);
      } else { // int16
        rawVal = byteOrder === "BE" ? buf.readInt16BE(0) : buf.readInt16LE(0);
      }
      
      const factor = (scale !== null && scale !== undefined) ? scale : 1.0;
      if (useDivisorFormula) {
        const offVal = (offset !== null && offset !== undefined) ? offset : 0.0;
        return (rawVal - offVal) / factor;
      } else {
        return rawVal * factor;
      }
    }

    const [
      temperature,
      zVelocity,
      xVelocity,
      zAcceleration,
      xAcceleration,
      pressure,
      flow,
      level
    ] = await Promise.all([
      readParam(device.regTemp, device.scaleTemp),
      readParam(device.regZVel, device.scaleZVel),
      readParam(device.regXVel, device.scaleXVel),
      readParam(device.regZAcc, device.scaleZAcc),
      readParam(device.regXAcc, device.scaleXAcc),
      readParam(device.regPressure, device.scalePressure, device.offsetPressure, true),
      readParam(device.regFlow, device.scaleFlow, device.offsetFlow, true),
      readParam(device.regLevel, device.scaleLevel, device.offsetLevel, true),
    ]);

    return {
      temperature,
      zVelocity,
      xVelocity,
      zAcceleration,
      xAcceleration,
      pressure,
      flow,
      level
    };
  }

  /**
   * Stop polling for a specific connection and close the serial port.
   */
  async stopPolling(connectionId: number) {
    const timer = this.timers.get(connectionId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(connectionId);
    }

    const client = this.clients.get(connectionId);
    if (client) {
      try {
        if (client._port && client._port._client && typeof client._port._client.destroy === "function") {
          client._port._client.destroy();
        } else if (client._client && typeof client._client.destroy === "function") {
          client._client.destroy();
        }
        client.close().catch(() => {});
      } catch { /* ignore close errors */ }
      this.clients.delete(connectionId);
    }

    // Clear runtime connection status
    this.connectionStates.delete(connectionId);
  }

  /**
   * Stop all active polling connections.
   */
  async stopAll() {
    const connIds = Array.from(this.timers.keys());
    for (const connId of connIds) {
      await this.stopPolling(connId);
    }
    this.isRunning = false;
    console.log("[Modbus] All polling stopped.");
  }

  /**
   * Restart all polling (call after config changes).
   */
  async restartAll() {
    await this.stopAll();
    await this.startAll();
  }
}

// Singleton instance exported for use in index.ts and controllers
export const modbusPollingService = new ModbusPollingService();
