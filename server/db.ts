import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "./db/schema";

neonConfig.webSocketConstructor = ws;

// Allow running without DATABASE_URL for local development
let pool: Pool | null = null;
let db: any = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle({ client: pool, schema });
} else {
  console.warn("⚠️  DATABASE_URL not set - running in local file mode");
  // Create mock database functions for local development
  db = {
    select: () => ({
      from: () => ({
        where: () => []
      })
    }),
    insert: () => ({
      values: () => ({
        returning: () => []
      })
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => []
        })
      })
    })
  };
}

export { pool, db };
