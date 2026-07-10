import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/config/env";
import { schema } from "@/db/schema";

const client = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
export { client as postgresClient };
