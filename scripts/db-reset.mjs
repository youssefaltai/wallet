import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);
await sql.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
await sql.end();
console.log("Database reset.");
