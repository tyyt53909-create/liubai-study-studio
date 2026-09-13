import { Router } from "express";
import { z } from "zod";
import type { Snapshot } from "../../shared/domain.ts";
import { capacity, isoDay } from "../../shared/domain.ts";
import { pool, tx } from "../db.ts";
import { clock, minutes, Problem } from "../services/common.ts";
import { snapshot } from "../services/snapshot.ts";
const app = Router();
app.put("/api/locale", async (req, res) => {
  const b = z.object({ locale: z.enum(["zh-Hant", "en"]) }).parse(req.body);
  await pool.query("UPDATE settings SET locale=$1 WHERE id=1", [b.locale]);
  res.json({ ok: true });
});
app.put("/api/routine", async (req, res) => {
  const b = z
    .object({
      days: z
        .array(z.object({ english: minutes, flexible: minutes, start: clock }))
        .length(7),
    })
    .parse(req.body);
  await pool.query("UPDATE settings SET routine=$1 WHERE id=1", [
    JSON.stringify(b),
  ]);
  res.json({ ok: true });
});
app.post("/api/routine/start", async (_req, res) => {
  const t = await tx(async (c) => {
    const day = isoDay();
    const old = (
      await c.query("SELECT * FROM tasks WHERE routine_date=$1", [day])
    ).rows[0];
    if (old) return old;
    const r = (await c.query("SELECT routine FROM settings WHERE id=1")).rows[0]
      .routine.days[new Date(`${day}T12:00:00+08:00`).getUTCDay()];
    if (r.english <= 0) throw new Problem("今天沒有設定固定英文時間");
    const state = await snapshot(c);
    const allocation = capacity(
      state as unknown as Snapshot,
      day,
      "ENGLISH",
      Date.now(),
    ).implicit;
    if (allocation <= 0)
      throw new Problem("英文時間已安排到其他任務，直接開始那些任務即可");
    const subject = (
      await c.query("SELECT id FROM subjects WHERE name='English'")
    ).rows[0];
    const task = (
      await c.query(
        "INSERT INTO tasks(title,subject_id,estimated,remaining,bucket,routine_date) VALUES('每日英文', $1,$2,$2,'ENGLISH',$3) RETURNING *",
        [subject.id, allocation, day],
      )
    ).rows[0];
    await c.query(
      "INSERT INTO plans(task_id,level,on_date) VALUES($1,'DAY',$2)",
      [task.id, day],
    );
    return task;
  });
  res.json(t);
});

export default app;
