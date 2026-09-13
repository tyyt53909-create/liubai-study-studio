import { readFile } from "node:fs/promises";
import pg from "pg";
pg.types.setTypeParser(1082, (v) => v);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error("DATABASE_URL is required; run npm run setup first");
export const pool = new pg.Pool({ connectionString: databaseUrl });
export async function migrate() {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(872314)");
    await c.query(
      await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
    );
    await c.query(
      await readFile(
        new URL("./migrations/002-foundation.sql", import.meta.url),
        "utf8",
      ),
    );
    await c.query(
      await readFile(
        new URL("./migrations/003-daily-workflow.sql", import.meta.url),
        "utf8",
      ),
    );
    await c.query(
      await readFile(
        new URL("./migrations/004-settings-prefs.sql", import.meta.url),
        "utf8",
      ),
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(872315)");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
