import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, types } from "pg";
import * as schema from "./schema";

// Force node-postgres to parse TIMESTAMP WITHOUT TIME ZONE (OID 1114) as UTC Date objects
types.setTypeParser(1114, (val) => {
  return val ? new Date(val + "Z") : null;
});

const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5435/vibration_db";

const pool = new Pool({
  connectionString,
});

export const db = drizzle(pool, { schema });
