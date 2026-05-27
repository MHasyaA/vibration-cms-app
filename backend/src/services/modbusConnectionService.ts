import { db } from "../db/connection";
import { modbusConnections, devices } from "../db/schema";
import { eq, sql } from "drizzle-orm";

export class ModbusConnectionService {
  async getAllConnections() {
    return await db
      .select()
      .from(modbusConnections)
      .orderBy(modbusConnections.id);
  }

  async getConnectionById(id: number) {
    const [conn] = await db
      .select()
      .from(modbusConnections)
      .where(eq(modbusConnections.id, id))
      .limit(1);
    return conn || null;
  }

  async getActiveConnections() {
    return await db
      .select()
      .from(modbusConnections)
      .where(eq(modbusConnections.isActive, true));
  }

  async createConnection(data: {
    portName: string;
    baudRate?: number;
    dataBits?: number;
    stopBits?: number;
    parity?: string;
    timeout?: number;
    pollInterval?: number;
    isActive?: boolean;
  }) {
    // Check if portName is already taken
    const existing = await db
      .select()
      .from(modbusConnections)
      .where(eq(modbusConnections.portName, data.portName))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Koneksi dengan port ${data.portName} sudah ada`);
    }

    const [inserted] = await db
      .insert(modbusConnections)
      .values(data)
      .returning();
    return inserted;
  }

  async updateConnection(
    id: number,
    data: {
      portName?: string;
      baudRate?: number;
      dataBits?: number;
      stopBits?: number;
      parity?: string;
      timeout?: number;
      pollInterval?: number;
      isActive?: boolean;
    }
  ) {
    // If portName is being changed, make sure it's not taken
    if (data.portName !== undefined) {
      const existing = await db
        .select()
        .from(modbusConnections)
        .where(eq(modbusConnections.portName, data.portName))
        .limit(1);

      if (existing.length > 0 && existing[0].id !== id) {
        throw new Error(`Port ${data.portName} sudah digunakan oleh koneksi lain`);
      }
    }

    const [updated] = await db
      .update(modbusConnections)
      .set(data)
      .where(eq(modbusConnections.id, id))
      .returning();

    if (!updated) {
      throw new Error(`Koneksi dengan ID ${id} tidak ditemukan`);
    }

    return updated;
  }

  async deleteConnection(id: number) {
    // Before deleting, clear connectionId on devices using this connection
    await db
      .update(devices)
      .set({ connectionId: null })
      .where(eq(devices.connectionId, id));

    const [deleted] = await db
      .delete(modbusConnections)
      .where(eq(modbusConnections.id, id))
      .returning();

    if (!deleted) {
      throw new Error(`Koneksi dengan ID ${id} tidak ditemukan`);
    }

    return deleted;
  }

  // Get devices associated with a connection (for polling)
  async getDevicesByConnectionId(connectionId: number) {
    return await db
      .select()
      .from(devices)
      .where(eq(devices.connectionId, connectionId));
  }
}
