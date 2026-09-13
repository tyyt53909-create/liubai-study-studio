#!/usr/bin/env node
/**
 * Generate local secrets for first run.
 *   npm run setup
 *   node scripts/setup.mjs --domain study.example.com --email you@example.com
 *   node scripts/setup.mjs --print-password   # after setup, show .login-secret once
 *
 * Never commits .env or .login-secret. Refuses to overwrite an existing .env.
 */
import { randomBytes, scryptSync } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import webpush from "web-push";

const { values } = parseArgs({
  options: {
    domain: { type: "string" },
    email: { type: "string" },
    origin: { type: "string" },
    "print-password": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
  strict: true,
});

if (values.help) {
  console.log(`Usage:
  node scripts/setup.mjs [--domain HOST] [--email ADDR] [--origin URL]
  node scripts/setup.mjs --print-password

  --domain   Production host (sets PUBLIC_ORIGIN=https://HOST)
  --email    Contact for VAPID (mailto:)
  --origin   Full PUBLIC_ORIGIN override (http://localhost:4317 or https://...)
  --print-password  Print initial password from .login-secret (once you already ran setup)
`);
  process.exit(0);
}

if (values["print-password"]) {
  try {
    const secret = (await readFile(".login-secret", "utf8")).trim();
    if (!secret) throw new Error("empty");
    console.log(secret);
    process.exit(0);
  } catch {
    console.error(
      "No .login-secret found. Run setup first, or the file was removed after you saved the password.",
    );
    process.exit(1);
  }
}

try {
  await access(".env");
  console.error(
    ".env already exists; preserve existing credentials and edit it deliberately.",
  );
  console.error(
    "Initial login password (if still present): .login-secret — or: npm run setup -- --print-password",
  );
  process.exit(1);
} catch (e) {
  if (e && e.code !== "ENOENT") throw e;
}

function publicOrigin() {
  if (values.origin) {
    const u = new URL(values.origin);
    if (!["http:", "https:"].includes(u.protocol))
      throw new Error("--origin must be http(s)");
    return u.origin;
  }
  if (values.domain) {
    const host = values.domain
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .toLowerCase();
    if (!host || /[\s/]/.test(host)) throw new Error("Invalid --domain");
    if (host === "localhost" || host.endsWith(".local"))
      return `http://${host}${host === "localhost" ? ":4317" : ""}`;
    return `https://${host}`;
  }
  return "http://localhost:4317";
}

const origin = publicOrigin();
const email = (values.email || "you@example.com").replace(/^mailto:/i, "");
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  throw new Error("--email must look like an email address");

const password = randomBytes(18).toString("base64url");
const salt = randomBytes(16).toString("hex");
const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
const keys = webpush.generateVAPIDKeys();
const dbPassword = randomBytes(24).toString("hex");

const envBody = [
  `PUBLIC_ORIGIN=${origin}`,
  `STUDY_PASSWORD_HASH=${passwordHash}`,
  `POSTGRES_PASSWORD=${dbPassword}`,
  `DATABASE_URL=postgres://study:${dbPassword}@localhost:55439/study`,
  `PORT=4317`,
  `HOST=127.0.0.1`,
  `VAPID_PUBLIC_KEY=${keys.publicKey}`,
  `VAPID_PRIVATE_KEY=${keys.privateKey}`,
  `VAPID_SUBJECT=mailto:${email}`,
  "",
].join("\n");

await writeFile(".env", envBody, { mode: 0o600, flag: "wx" });
await writeFile(".login-secret", password + "\n", { mode: 0o600, flag: "wx" });

console.log("Private settings written.");
console.log(`  PUBLIC_ORIGIN=${origin}`);
console.log("  .env                  (mode 600) — hashes & keys only");
console.log("  .login-secret         (mode 600) — initial login password");
console.log("");
console.log("Initial login password:");
console.log(`  ${password}`);
console.log("");
console.log(
  "Save it in your password manager, then sign in and change it under Settings.",
);
console.log(
  "Do not commit .env or .login-secret. Existing PostgreSQL volumes keep their old DB password.",
);
