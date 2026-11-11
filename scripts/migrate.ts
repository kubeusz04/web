import { initDb } from "../src/lib/db";
await initDb();
console.log(
  "Base schema applied. For Supabase, also apply migrations/002-postgres-security.sql in SQL Editor.",
);
process.exit(0);
