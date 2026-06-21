import { db } from "../db/connection";
import { devices } from "../db/schema";
import { eq } from "drizzle-orm";

export class DeviceService {
  async getAllDevices() {
    return await db.select().from(devices).orderBy(devices.id);
  }

  async getDeviceById(id: number) {
    const [device] = await db
      .select()
      .from(devices)
      .where(eq(devices.id, id))
      .limit(1);
    return device || null;
  }

  async getDeviceBySlaveId(slaveId: number) {
    const [device] = await db
      .select()
      .from(devices)
      .where(eq(devices.slaveId, slaveId))
      .limit(1);
    return device || null;
  }

  async createDevice(data: {
    slaveId: number;
    namaSensor: string;
    lokasi: string;
    setpointTemp?: number;
    setpointZVel?: number;
    setpointXVel?: number;
    setpointZAcc?: number;
    setpointXAcc?: number;
    setpointPressure?: number;
    setpointFlow?: number;
    setpointLevel?: number;
    // Phase #4: Modbus config
    connectionId?: number | null;
    regTemp?: number | null;
    regZVel?: number | null;
    regXVel?: number | null;
    regZAcc?: number | null;
    regXAcc?: number | null;
    regPressure?: number | null;
    regFlow?: number | null;
    regLevel?: number | null;
    regDataType?: string;
    regByteOrder?: string;
    scaleTemp?: number | null;
    scaleZVel?: number | null;
    scaleXVel?: number | null;
    scaleZAcc?: number | null;
    scaleXAcc?: number | null;
    scalePressure?: number | null;
    scaleFlow?: number | null;
    scaleLevel?: number | null;
    offsetPressure?: number | null;
    offsetFlow?: number | null;
    offsetLevel?: number | null;
  }) {
    // Check if slaveId is already taken
    const existing = await this.getDeviceBySlaveId(data.slaveId);
    if (existing) {
      throw new Error(`Device with Slave ID ${data.slaveId} already exists`);
    }

    const [inserted] = await db.insert(devices).values(data).returning();
    return inserted;
  }

  async getDevicesByConnectionId(connectionId: number) {
    return await db
      .select()
      .from(devices)
      .where(eq(devices.connectionId, connectionId));
  }

  async updateDevice(
    id: number,
    data: {
      slaveId?: number;
      namaSensor?: string;
      lokasi?: string;
      setpointTemp?: number;
      setpointZVel?: number;
      setpointXVel?: number;
      setpointZAcc?: number;
      setpointXAcc?: number;
      setpointPressure?: number;
      setpointFlow?: number;
      setpointLevel?: number;
      // Phase #4: Modbus config
      connectionId?: number | null;
      regTemp?: number | null;
      regZVel?: number | null;
      regXVel?: number | null;
      regZAcc?: number | null;
      regXAcc?: number | null;
      regPressure?: number | null;
      regFlow?: number | null;
      regLevel?: number | null;
      regDataType?: string | null;
      regByteOrder?: string | null;
      scaleTemp?: number | null;
      scaleZVel?: number | null;
      scaleXVel?: number | null;
      scaleZAcc?: number | null;
      scaleXAcc?: number | null;
      scalePressure?: number | null;
      scaleFlow?: number | null;
      scaleLevel?: number | null;
      offsetPressure?: number | null;
      offsetFlow?: number | null;
      offsetLevel?: number | null;
    }
  ) {
    // If slaveId is being changed, make sure it's not taken by another device
    if (data.slaveId !== undefined) {
      const existing = await this.getDeviceBySlaveId(data.slaveId);
      if (existing && existing.id !== id) {
        throw new Error(`Device with Slave ID ${data.slaveId} already exists`);
      }
    }

    const [updated] = await db
      .update(devices)
      .set(data)
      .where(eq(devices.id, id))
      .returning();
    
    if (!updated) {
      throw new Error(`Device with ID ${id} not found`);
    }
    
    return updated;
  }

  async deleteDevice(id: number) {
    const [deleted] = await db
      .delete(devices)
      .where(eq(devices.id, id))
      .returning();
    
    if (!deleted) {
      throw new Error(`Device with ID ${id} not found`);
    }
    
    return deleted;
  }
}
