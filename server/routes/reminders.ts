import { Router } from "express";
import webpush from "web-push";
import { z } from "zod";
import { pool, tx } from "../db.ts";
import { id, instant, Problem, task } from "../services/common.ts";
import {
  acknowledge,
  claimReminders,
  pushTick,
  validateDelivery,
} from "../services/reminders.ts";
const app = Router();
const subscriptionInput = z.object({
  endpoint: z
    .url()
    .refine(
      (v) =>
        /^https:\/\/(.*\.)?(push\.services\.mozilla\.com|fcm\.googleapis\.com|web\.push\.apple\.com|notify\.windows\.com)\//.test(
          v,
        ),
      "不支援的推送服務",
    ),
  keys: z.object({
    p256dh: z.string().min(10).max(200),
    auth: z.string().min(10).max(100),
  }),
});
app.put("/api/tasks/:id/reminder", async (req, res) => {
  const taskId = id.parse(req.params.id),
    b = z.object({ due_at: instant.nullable() }).parse(req.body);
  await tx(async (c) => {
    const t = await task(c, taskId);
    if (["COMPLETED", "CANCELLED"].includes(t.status))
      throw new Problem("此任務已結束");
    if (b.due_at && new Date(b.due_at).getTime() < Date.now())
      throw new Problem("請選擇未來的提醒時間");
    await c.query(
      "UPDATE plans SET remind_at_start=false WHERE task_id=$1 AND remind_at_start",
      [taskId],
    );
    await c.query("DELETE FROM reminders WHERE task_id=$1", [taskId]);
    if (b.due_at)
      await c.query("INSERT INTO reminders(task_id,due_at) VALUES($1,$2)", [
        taskId,
        b.due_at,
      ]);
  });
  res.json({ ok: true });
});
app.post("/api/reminders/claim", async (req, res) => {
  const { deviceId } = z.object({ deviceId: id }).parse(req.body);
  // Push owns new dispatches, but a prior browser claim must still be recoverable.
  const hasPush = Boolean(
    process.env.VAPID_PRIVATE_KEY &&
      (await pool.query("SELECT 1 FROM push_subscriptions LIMIT 1")).rowCount,
  );
  const claims = await claimReminders("browser:" + deviceId, !hasPush);
  res.json(
    claims.map((r) => ({
      id: r.id,
      taskId: r.task_id,
      claimToken: r.claim_token,
    })),
  );
});
app.post("/api/reminders/:id/validate", async (req, res) => {
  const r = await validateDelivery(
    id.parse(req.params.id),
    id.parse(req.body.claimToken),
  );
  if (!r) return res.status(404).json({ error: "提醒已失效" });
  res.json(r);
});
app.post("/api/reminders/:id/ack", async (req, res) => {
  const r = await acknowledge(
    id.parse(req.params.id),
    id.parse(req.body.claimToken),
  );
  if (!r.rowCount) return res.status(404).json({ error: "提醒已失效" });
  res.json({ ok: true });
});
app.post("/api/push/subscribe", async (req, res) => {
  const b = subscriptionInput.parse(req.body);
  const existing = await pool.query(
    "SELECT 1 FROM push_subscriptions WHERE endpoint=$1",
    [b.endpoint],
  );
  if (!existing.rowCount) {
    const count = await pool.query("SELECT COUNT(*) FROM push_subscriptions");
    if (Number(count.rows[0].count) >= 20)
      return res.status(429).json({ error: "推送裝置數量已達上限" });
  }
  await pool.query(
    "INSERT INTO push_subscriptions(endpoint,subscription) VALUES($1,$2) ON CONFLICT(endpoint) DO UPDATE SET subscription=$2",
    [b.endpoint, JSON.stringify(b)],
  );
  res.json({ ok: true });
});
app.delete("/api/push/subscribe", async (req, res) => {
  const { endpoint } = z.object({ endpoint: subscriptionInput.shape.endpoint }).parse(req.body);
  await pool.query("DELETE FROM push_subscriptions WHERE endpoint=$1", [endpoint]);
  res.json({ ok: true });
});
export function startReminderWorker() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:you@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  let running = false;
  const work = async () => {
    if (running) return;
    running = true;
    try {
      await pushTick();
    } catch (e) {
      console.error("Reminder worker failed", e);
    } finally {
      running = false;
    }
  };
  setInterval(work, 5000).unref();
  void work();
}
export default app;
