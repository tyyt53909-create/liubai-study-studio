import { spawn } from "node:child_process";
import { scryptSync } from "node:crypto";
import { once } from "node:events";
import pg from "pg";
const password = "test-only-not-for-deployment-v02";
const salt = "0123456789abcdef0123456789abcdef";
const hash = salt + ":" + scryptSync(password, salt, 64).toString("hex");
const url =
  process.env.TEST_DATABASE_URL ||
  "postgres://study:study_local@localhost:55439/study_test";
if (new URL(url).pathname !== "/study_test")
  throw new Error("Tests require the dedicated study_test database");
const adminURL = new URL(url);
adminURL.pathname = "/postgres";
const db = new pg.Client({ connectionString: adminURL.href });
await db.connect();
if (
  !(await db.query("SELECT 1 FROM pg_database WHERE datname='study_test'"))
    .rowCount
)
  await db.query("CREATE DATABASE study_test");
await db.end();
const port = process.env.TEST_PORT || "4318";
let existing = false;
try {
  existing = (
    await fetch(`http://localhost:${port}/api/health`, {
      signal: AbortSignal.timeout(500),
    })
  ).ok;
} catch {}
if (existing)
  throw new Error(
    `Test port ${port} is in use. Stop the old test server or choose TEST_PORT.`,
  );
const server = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
  env: {
    ...process.env,
    VAPID_PRIVATE_KEY: "",
    VAPID_PUBLIC_KEY: "",
    NODE_ENV: "production",
    STUDY_PASSWORD_HASH: hash,
    PUBLIC_ORIGIN: `http://localhost:${port}`,
    DATABASE_URL: url,
    PORT: port,
    HOST: "127.0.0.1",
  },
  stdio: ["ignore", "pipe", "inherit"],
});
try {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Test server startup timeout")),
      15000,
    );
    server.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error("Test server exited " + code));
    });
    server.stdout.on("data", (chunk) => {
      if (String(chunk).includes("Study Studio ready")) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  const runner = spawn(
    process.execPath,
    ["--import", "tsx", "--test", "tests/domain.test.ts", "tests/api.test.ts"],
    {
      env: {
        ...process.env,
        DATABASE_URL: url,
        TEST_PASSWORD: password,
        TEST_URL: `http://localhost:${port}`,
        TEST_DATABASE_URL: url,
      },
      stdio: "inherit",
    },
  );
  const [code] = await once(runner, "exit");
  process.exitCode = Number(code ?? 1);
} finally {
  server.kill("SIGTERM");
  await once(server, "exit");
}
