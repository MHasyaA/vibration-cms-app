import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5435/vibration_db";

const pool = new Pool({
  connectionString,
});

export const db = drizzle(pool, { schema });
