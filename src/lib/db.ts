import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";
export type Row = Record<string, unknown>;
export interface Tx {
  all<T = Row>(sql: string, args?: unknown[]): Promise<T[]>;
  run(sql: string, args?: unknown[]): Promise<void>;
}
type State = {
  sqlite?: DatabaseSync;
  pool?: Pool;
  ready?: Promise<void>;
  tail: Promise<unknown>;
};
const globalDb = globalThis as unknown as { bliskoDb?: State };
const state = (globalDb.bliskoDb ??= { tail: Promise.resolve() });
globalDb.bliskoDb = state;
function pgSql(sql: string) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}
function sqliteTx(db: DatabaseSync): Tx {
  return {
    async all<T>(sql: string, args: unknown[] = []) {
      return db
        .prepare(sql)
        .all(...(args as (string | number | null)[])) as T[];
    },
    async run(sql, args = []) {
      db.prepare(sql).run(...(args as (string | number | null)[]));
    },
  };
}
export async function initDb() {
  if (!state.ready)
    state.ready = (async () => {
      const folder = path.join(process.cwd(), "migrations"),
        files = readdirSync(folder)
          .filter((f) => /^\d{3}\.sql$/.test(f))
          .sort();
      if (process.env.DATABASE_URL) {
        state.pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          max: 10,
        });
        const client = await state.pool.connect();
        try {
          await client.query("BEGIN");
          await client.query("SELECT pg_advisory_xact_lock(45219017)");
          await client.query(
            "CREATE TABLE IF NOT EXISTS schema_migrations(id TEXT PRIMARY KEY)",
          );
          for (const file of files) {
            const applied = await client.query(
              "SELECT id FROM schema_migrations WHERE id=$1",
              [file],
            );
            if (!applied.rows.length) {
              await client.query(readFileSync(path.join(folder, file), "utf8"));
              await client.query(
                "INSERT INTO schema_migrations(id) VALUES($1)",
                [file],
              );
            }
          }
          await client.query("COMMIT");
        } catch (e) {
          await client.query("ROLLBACK");
          throw e;
        } finally {
          client.release();
        }
      } else {
        if (process.env.APP_MODE !== "local" && process.env.NODE_ENV !== "test")
          throw new Error("DATABASE_URL is required outside local mode");
        const dir =
          process.env.BLISKO_DATA_DIR || path.join(process.cwd(), ".data");
        mkdirSync(dir, { recursive: true });
        state.sqlite = new DatabaseSync(path.join(dir, "blisko.sqlite"));
        state.sqlite.exec(
          "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;",
        );
        try {
          state.sqlite.exec(
            "CREATE TABLE IF NOT EXISTS schema_migrations(id TEXT PRIMARY KEY)",
          );
          for (const file of files)
            if (
              !state.sqlite
                .prepare("SELECT id FROM schema_migrations WHERE id=?")
                .get(file)
            ) {
              state.sqlite.exec(readFileSync(path.join(folder, file), "utf8"));
              state.sqlite
                .prepare("INSERT INTO schema_migrations(id) VALUES(?)")
                .run(file);
            }
          state.sqlite.exec("COMMIT");
        } catch (e) {
          state.sqlite.exec("ROLLBACK");
          throw e;
        }
      }
    })();
  return state.ready;
}
export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  await initDb();
  if (state.pool) {
    const client = await state.pool.connect();
    try {
      await client.query("BEGIN");
      const tx: Tx = {
        async all<R>(s: string, a: unknown[] = []) {
          return (await client.query(pgSql(s), a)).rows as R[];
        },
        async run(s, a = []) {
          await client.query(pgSql(s), a);
        },
      };
      const r = await fn(tx);
      await client.query("COMMIT");
      return r;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  const job = state.tail.then(async () => {
    state.sqlite!.exec("BEGIN IMMEDIATE");
    try {
      const r = await fn(sqliteTx(state.sqlite!));
      state.sqlite!.exec("COMMIT");
      return r;
    } catch (e) {
      state.sqlite!.exec("ROLLBACK");
      throw e;
    }
  });
  state.tail = job.catch(() => {});
  return job;
}
export async function query<T = Row>(
  sql: string,
  args: unknown[] = [],
): Promise<T[]> {
  return transaction((tx) => tx.all<T>(sql, args));
}
