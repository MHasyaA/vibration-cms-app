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
  // Track if the service has been started
  private isRunning = false;

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
      await this.startPolling(conn, ModbusRTU);
    }

    this.isRunning = true;
  }

  /**
   * Start polling for a single connection.
   */
  private async startPolling(connection: any, ModbusRTU: any) {
    const client = new ModbusRTU();

    try {
      await client.connectTCP(connection.ipAddress, {
        port: connection.tcpPort,
      });
      client.setTimeout(connection.timeout);
      this.clients.set(connection.id, client);
      console.log(`[Modbus] Connected to Modbus TCP @ ${connection.ipAddress}:${connection.tcpPort}`);
    } catch (err: any) {
      console.error(`[Modbus] Failed to connect to Modbus TCP at ${connection.ipAddress}:${connection.tcpPort}:`, err.message);
      return; // Skip this connection, don't crash
    }

    const timer = setInterval(async () => {
      await this.pollConnection(connection.id, client);
    }, connection.pollInterval);

    this.timers.set(connection.id, timer);
    console.log(`[Modbus] Polling started for Modbus TCP at ${connection.ipAddress}:${connection.tcpPort} every ${connection.pollInterval}ms`);
  }

  /**
   * Execute one polling cycle for a connection: read all its devices sequentially.
   */
  private async pollConnection(connectionId: number, client: any) {
    try {
      const connectedDevices = await deviceService.getDevicesByConnectionId(connectionId);

      for (const device of connectedDevices) {
        // Skip devices that don't have register mapping configured
        if (device.regTemp === null && device.regZVel === null) {
          continue;
        }

        try {
          client.setID(device.slaveId);
          const reading = await this.readDeviceRegisters(client, device);
          await dataService.insertSensorLog({ deviceId: device.id, ...reading });
        } catch (err: any) {
          console.error(`[Modbus] Error reading slave #${device.slaveId} (${device.namaSensor}):`, err.message);
          // Continue to next device - don't let one failure stop the whole bus
        }
      }
    } catch (err: any) {
      console.error(`[Modbus] Error during poll cycle for connectionId ${connectionId}:`, err.message);
    }
  }

  /**
   * Read all 5 parameters from a device's holding registers.
   * Supports int16, uint16, and float32 data types with BE/LE byte order.
   */
  private async readDeviceRegisters(client: any, device: any): Promise<SensorReading> {
    const dataType = device.regDataType || "float32";
    const byteOrder = device.regByteOrder || "BE";

    // float32 uses 2 registers per value, int16/uint16 uses 1 register per value
    const regsPerValue = dataType === "float32" ? 2 : 1;

    async function readParam(regAddr: number | null): Promise<number> {
      if (regAddr === null || regAddr === undefined) return 0;
      const result = await client.readHoldingRegisters(regAddr, regsPerValue);
      const buf = Buffer.from(result.buffer);
      if (dataType === "float32") {
        return byteOrder === "BE" ? buf.readFloatBE(0) : buf.readFloatLE(0);
      } else if (dataType === "uint16") {
        return byteOrder === "BE" ? buf.readUInt16BE(0) : buf.readUInt16LE(0);
      } else { // int16
        return byteOrder === "BE" ? buf.readInt16BE(0) : buf.readInt16LE(0);
      }
    }

    const [temperature, zVelocity, xVelocity, zAcceleration, xAcceleration] = await Promise.all([
      readParam(device.regTemp),
      readParam(device.regZVel),
      readParam(device.regXVel),
      readParam(device.regZAcc),
      readParam(device.regXAcc),
    ]);

    return { temperature, zVelocity, xVelocity, zAcceleration, xAcceleration };
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
        await client.close();
      } catch { /* ignore close errors */ }
      this.clients.delete(connectionId);
    }
  }

  /**
   * Stop all active polling connections.
   */
  async stopAll() {
    for (const connId of this.timers.keys()) {
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
