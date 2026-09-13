import express from "express";
import path from "node:path";
import { z } from "zod";
import { configureAuth } from "./auth.ts";
import { migrate, pool } from "./db.ts";
import history from "./routes/history.ts";
import reminders, { startReminderWorker } from "./routes/reminders.ts";
import reviews from "./routes/reviews.ts";
import sessions from "./routes/sessions.ts";
import settings from "./routes/settings.ts";
import state from "./routes/state.ts";
import subjects from "./routes/subjects.ts";
import subtasks from "./routes/subtasks.ts";
import tasks from "./routes/tasks.ts";
import { Problem } from "./services/common.ts";
const app = express();
app.disable("x-powered-by");
// Production traffic is terminated by the single trusted Caddy proxy.
// This makes req.ip useful for login throttling without trusting proxy headers
// in local/direct deployments.
app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : false);
app.use(express.json({ limit: "100kb" }));
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  const origin = req.headers.origin;
  if (
    origin &&
    origin !==
      new URL(process.env.PUBLIC_ORIGIN || `http://${req.headers.host}`).origin
  )
    return res.status(403).json({ error: "只接受本網站的操作" });
  if (req.headers["sec-fetch-site"] === "cross-site")
    return res.status(403).json({ error: "跨站請求已拒絕" });
  next();
});
app.get("/api/health", async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true });
});
configureAuth(app);
app.use(
  state,
  history,
  tasks,
  sessions,
  subtasks,
  subjects,
  reviews,
  settings,
  reminders,
);
app.use("/api", (_req, res) => res.status(404).json({ error: "找不到此功能" }));
await migrate();
startReminderWorker();
if (process.env.NODE_ENV !== "production") {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve("dist")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.resolve("dist/index.html")),
  );
}
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (err instanceof z.ZodError)
      return res.status(400).json({
        error: "請檢查輸入欄位",
        details: err.issues.map((x) => `${x.path.join(".")}: ${x.message}`),
      });
    if (err instanceof Problem)
      return res.status(err.status).json({ error: err.message });
    const code = (err as { code?: string })?.code;
    if (code === "23503")
      return res.status(400).json({ error: "科目與 Topic 不相符，請重新選擇" });
    if (code === "23505")
      return res
        .status(409)
        .json({ error: "已有相同資料或另一個學習正在進行" });
    console.error(err);
    res
      .status(500)
      .json({ error: "暫時無法儲存，請稍後再試。原有資料保持不變。" });
  },
);
const server = app.listen(
  Number(process.env.PORT ?? 4317),
  process.env.HOST ?? "127.0.0.1",
  () => console.log("Study Studio ready on port", process.env.PORT ?? 4317),
);
process.on("SIGTERM", () =>
  server.close(() => {
    void pool.end().then(() => process.exit(0));
  }),
);
