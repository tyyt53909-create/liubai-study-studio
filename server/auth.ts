import type { Express, Request } from "express";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { pool, tx } from "./db.ts";
import { Problem } from "./services/common.ts";
const derive = promisify(scrypt);
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const authOrigin = new URL(
  process.env.PUBLIC_ORIGIN || "http://localhost:4317",
);
const cookieName =
  authOrigin.protocol === "https:"
    ? "__Host-study_session"
    : "study_session_" + (authOrigin.port || "80");
const loginRate = new Map<string, { count: number; resetAt: number }>();
const LOGIN_WINDOW_MS = 60_000;
const LOGIN_MAX_REQUESTS = 12;
function loginKey(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}
function loginAllowed(req: Request) {
  const now = Date.now();
  const key = loginKey(req);
  const current = loginRate.get(key);
  if (!current || current.resetAt <= now) return true;
  if (current.count >= LOGIN_MAX_REQUESTS) return false;
  return true;
}
function recordLoginFailure(req: Request) {
  const now = Date.now();
  const key = loginKey(req);
  const current = loginRate.get(key);
  if (!current || current.resetAt <= now)
    loginRate.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  else current.count++;
  if (loginRate.size > 10000)
    for (const [k, v] of loginRate) if (v.resetAt <= now) loginRate.delete(k);
}
function token(req: Request) {
  return (
    req.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1) || ""
  );
}
function parseHash(configured: string) {
  const [salt, encoded] = configured.split(":");
  if (!/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(encoded || ""))
    throw new Error("Invalid password hash configuration");
  return { salt, encoded };
}
async function configuredHash(c: { query: typeof pool.query }) {
  const row = (
    await c.query("SELECT password_hash FROM settings WHERE id=1")
  ).rows[0];
  return row?.password_hash || process.env.STUDY_PASSWORD_HASH || null;
}
async function verifyPassword(password: string, configured: string) {
  const { salt, encoded } = parseHash(configured);
  const key = (await derive(password, salt, 64)) as Buffer;
  return timingSafeEqual(key, Buffer.from(encoded, "hex"));
}
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await derive(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
export function configureAuth(app: Express) {
  const origin = new URL(process.env.PUBLIC_ORIGIN || "http://localhost:4317");
  if (
    origin.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
  )
    throw new Error("Remote deployment requires HTTPS PUBLIC_ORIGIN");
  const secure = origin.protocol === "https:";
  if (process.env.PRIVATE_DEPLOYMENT === "true") {
    const password = new URL(process.env.DATABASE_URL || "postgres://localhost")
      .password;
    if (
      !secure ||
      password.length < 20 ||
      password === "study_local" ||
      !process.env.STUDY_PASSWORD_HASH
    )
      throw new Error(
        "Private production requires HTTPS and unique database/login credentials",
      );
  }
  const cookie = (value: string, age: number) =>
    `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secure ? "; Secure" : ""}`;
  app.post("/api/auth/login", async (req, res) => {
    if (!loginAllowed(req))
      return res.status(429).json({ error: "嘗試過於頻繁，請稍後再試" });
    const password = req.body?.password;
    if (typeof password !== "string" || password.length > 512)
      return res.status(400).json({ error: "請輸入密碼" });
    const result = await tx(async (c) => {
      const configured = await configuredHash(c);
      if (!configured) return 503;
      const a = (
        await c.query("SELECT * FROM auth_attempts WHERE id=1 FOR UPDATE")
      ).rows[0];
      if (a.blocked_until && new Date(a.blocked_until).getTime() > Date.now())
        return 429;
      if (!(await verifyPassword(password, configured))) {
        recordLoginFailure(req);
        await c.query(
          "UPDATE auth_attempts SET failures=failures+1,blocked_until=CASE WHEN failures>=4 THEN now()+interval '1 minute' ELSE NULL END WHERE id=1",
        );
        return 401;
      }
      await c.query(
        "UPDATE auth_attempts SET failures=0,blocked_until=NULL WHERE id=1",
      );
      loginRate.delete(loginKey(req));
      await c.query("DELETE FROM auth_sessions WHERE expires_at<now()");
      await c.query("DELETE FROM auth_sessions WHERE token_hash=$1", [
        digest(token(req)),
      ]);
      const value = randomBytes(32).toString("hex");
      await c.query(
        "INSERT INTO auth_sessions(token_hash,expires_at) VALUES($1,now()+interval '30 days')",
        [digest(value)],
      );
      return value;
    });
    if (typeof result === "number")
      return res.status(result).json({
        error:
          result === 503
            ? "請先在主機執行 npm run setup 設定私人登入"
            : result === 429
              ? "嘗試過於頻繁，請一分鐘後再試"
              : "密碼不正確",
      });
    res.setHeader("Set-Cookie", cookie(result, 30 * 86400));
    res.json({ ok: true });
  });
  app.use("/api", async (req, res, next) => {
    const raw = token(req);
    if (
      !/^[a-f0-9]{64}$/.test(raw) ||
      !(
        await pool.query(
          "SELECT 1 FROM auth_sessions WHERE token_hash=$1 AND expires_at>now()",
          [digest(raw)],
        )
      ).rowCount
    )
      return res.status(401).json({ error: "請先登入私人學習空間" });
    next();
  });
  app.get("/api/auth/session", (_req, res) => res.json({ ok: true }));
  app.post("/api/auth/logout", async (req, res) => {
    await pool.query("DELETE FROM auth_sessions WHERE token_hash=$1", [
      digest(token(req)),
    ]);
    res.setHeader("Set-Cookie", cookie("", 0));
    res.json({ ok: true });
  });
  app.post("/api/auth/password", async (req, res) => {
    const b = z
      .object({
        current_password: z.string().min(1).max(512),
        new_password: z.string().min(8).max(128),
      })
      .parse(req.body);
    if (b.current_password === b.new_password)
      return res.status(400).json({ error: "新密碼不能與目前密碼相同" });
    const current = token(req);
    await tx(async (c) => {
      const configured = await configuredHash(c);
      if (!configured) throw new Problem("未設定登入密碼", 503);
      if (!(await verifyPassword(b.current_password, configured)))
        throw new Problem("目前密碼不正確", 401);
      const next = await hashPassword(b.new_password);
      await c.query("UPDATE settings SET password_hash=$1 WHERE id=1", [next]);
      await c.query(
        "DELETE FROM auth_sessions WHERE token_hash<>$1 OR expires_at<now()",
        [digest(current)],
      );
      await c.query(
        "UPDATE auth_attempts SET failures=0,blocked_until=NULL WHERE id=1",
      );
    });
    res.json({ ok: true });
  });
}
