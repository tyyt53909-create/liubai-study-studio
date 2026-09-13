// Restore a pre-v0.3 dump to this isolated database before running.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
if (
  !process.env.DATABASE_URL ||
  new URL(process.env.DATABASE_URL).pathname !== "/study_upgrade_v03_verify"
)
  throw new Error(
    "Requires isolated study_upgrade_v03_verify; never use the live database",
  );
const { pool, migrate } = await import("../server/db.ts");
try {
  const tables = (
    await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name",
    )
  ).rows.map((r) => r.table_name);
  const columns = {},
    before = {};
  const quote = (s) => '"' + s.replaceAll('"', '""') + '"';
  const snapshot = async (table) => {
    const rows = (
      await pool.query(
        `SELECT ${columns[table].map(quote).join(",")} FROM ${quote(table)}`,
      )
    ).rows;
    return rows.map((r) => JSON.stringify(r)).sort();
  };
  for (const table of tables) {
    columns[table] = (
      await pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
        [table],
      )
    ).rows.map((r) => r.column_name);
    before[table] = await snapshot(table);
  }
  await migrate();
  await migrate();
  for (const table of tables)
    assert.deepEqual(
      await snapshot(table),
      before[table],
      `${table}: original rows/columns changed`,
    );
  const oldPlans = await pool.query(
    "SELECT 1 FROM plans WHERE remind_at_start",
  );
  assert.equal(oldPlans.rowCount, 0);
  const report = {
    status: "PASS",
    migrations: 2,
    originalColumnsPreserved: true,
    oldFixedRemindersOptedIn: false,
    tables: Object.fromEntries(tables.map((t) => [t, before[t].length])),
    at: new Date().toISOString(),
  };
  await mkdir("artifacts/v03", { recursive: true });
  await writeFile(
    "artifacts/v03/upgrade-preservation.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await pool.end();
}
