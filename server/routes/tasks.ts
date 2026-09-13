import { Router } from "express";
import { z } from "zod";
import type { Session } from "../../shared/domain.ts";
import { weekStart } from "../../shared/domain.ts";
import { tx } from "../db.ts";
import {
  clock,
  closeInterval,
  date,
  id,
  minutes,
  planInput,
  Problem,
  task,
  taskInput,
} from "../services/common.ts";
const app = Router();
app.post("/api/tasks", async (req, res) => {
  const b = taskInput
    .extend({
      on_date: date.nullable().default(null),
      fixed_time: clock.nullable().default(null),
      remind_at_start: z.boolean().optional(),
    })
    .parse(req.body);
  if (b.fixed_time && !b.on_date) throw new Problem("請選擇指定時間的日期");
  const t = await tx(async (c) => {
    const t = (
      await c.query(
        "INSERT INTO tasks(title,subject_id,topic_id,estimated,remaining,note,is_review,bucket) VALUES($1,$2,$3,$4,COALESCE($4::double precision,0),$5,$6,$7) RETURNING *",
        [
          b.title,
          b.subject_id,
          b.topic_id,
          b.estimated,
          b.note,
          b.is_review,
          b.bucket,
        ],
      )
    ).rows[0];
    const fixed = Boolean(b.fixed_time);
    const linked = fixed && (b.remind_at_start ?? true);
    await c.query(
      "INSERT INTO plans(task_id,level,on_date,fixed_time,remind_at_start) VALUES($1,$2,$3,$4,$5)",
      [
        t.id,
        fixed ? "FIXED" : b.on_date ? "DAY" : "UNSCHEDULED",
        b.on_date,
        b.fixed_time,
        linked,
      ],
    );
    if (linked)
      await c.query(
        "INSERT INTO reminders(task_id,due_at,source) VALUES($1,($2::text || 'T' || $3 || ':00+08:00')::timestamptz,'fixed')",
        [t.id, b.on_date, b.fixed_time],
      );
    for (const s of b.subtasks)
      await c.query("INSERT INTO subtasks(task_id,title) VALUES($1,$2)", [
        t.id,
        s,
      ]);
    return t;
  });
  res.status(201).json(t);
});
app.patch("/api/tasks/:id", async (req, res) => {
  const taskId = id.parse(req.params.id);
  const parsed = taskInput
    .omit({ subtasks: true })
    .partial()
    .extend({ remaining: minutes.optional() })
    .parse(req.body);
  // Creation defaults must not overwrite omitted fields in a partial update.
  const b = Object.fromEntries(
    Object.entries(parsed).filter(([key]) => Object.hasOwn(req.body, key)),
  ) as typeof parsed;
  await tx(async (c) => {
    const t = await task(c, taskId);
    if (["COMPLETED", "CANCELLED"].includes(t.status))
      throw new Problem("已結束的任務不能修改");
    if (
      (b.bucket && b.bucket !== t.bucket) ||
      (b.subject_id !== undefined && b.subject_id !== t.subject_id) ||
      (b.topic_id !== undefined && b.topic_id !== t.topic_id)
    ) {
      const existing = await c.query(
        "SELECT id FROM sessions WHERE task_id=$1 LIMIT 1",
        [taskId],
      );
      if (existing.rowCount && t.subject_id !== null)
        throw new Problem(
          "已有學習紀錄的任務保留原科目與分類，請另建任務以保持歷史正確",
        );
    }
    const active = (
      await c.query(
        "SELECT * FROM sessions WHERE task_id=$1 AND state IN ('RUNNING','PAUSED')",
        [taskId],
      )
    ).rows[0] as Session | undefined;
    if (active) {
      if (
        t.subject_id !== null &&
        ((b.bucket && b.bucket !== t.bucket) ||
          (b.subject_id !== undefined && b.subject_id !== t.subject_id) ||
          (b.topic_id !== undefined && b.topic_id !== t.topic_id))
      )
        throw new Problem("請先暫時停止，再更改科目或時間分類");
      if (
        (b.remaining !== undefined ||
          (t.estimated === null && b.estimated != null)) &&
        active.state === "RUNNING"
      ) {
        const at = new Date();
        await closeInterval(c, active, at);
        await c.query(
          "INSERT INTO intervals(session_id,start_at) VALUES($1,$2)",
          [active.id, at],
        );
      }
    }
    if (
      b.topic_id &&
      !(b.subject_id === undefined ? t.subject_id : b.subject_id)
    )
      throw new Problem("請先選擇 Topic 所屬科目");
    if (
      t.estimated === null &&
      b.estimated != null &&
      b.remaining === undefined
    ) {
      const elapsed = Number(
        (
          await c.query(
            "SELECT COALESCE(SUM(EXTRACT(EPOCH FROM(i.end_at-i.start_at))/60),0) n FROM intervals i JOIN sessions s ON s.id=i.session_id WHERE s.task_id=$1 AND i.end_at IS NOT NULL",
            [taskId],
          )
        ).rows[0].n,
      );
      b.remaining = Math.max(0, b.estimated - elapsed);
    }
    if (b.estimated === null && t.estimated !== null) b.remaining = 0;
    const entries = Object.entries(b);
    if (entries.length)
      await c.query(
        `UPDATE tasks SET ${entries.map(([key], i) => `${key}=$${i + 2}`).join(",")} WHERE id=$1`,
        [taskId, ...entries.map(([, value]) => value)],
      );
  });
  res.json({ ok: true });
});
app.put("/api/tasks/:id/plan", async (req, res) => {
  const taskId = id.parse(req.params.id);
  const b = planInput.parse(req.body);
  if (b.level !== "UNSCHEDULED" && !b.on_date) throw new Problem("請選擇日期");
  if (b.level === "FIXED" && !b.fixed_time) throw new Problem("請設定時間");
  const on =
    b.level === "UNSCHEDULED"
      ? null
      : b.level === "MONTH"
        ? b.on_date!.slice(0, 7) + "-01"
        : b.level === "WEEK"
          ? weekStart(b.on_date!)
          : b.on_date;
  await tx(async (c) => {
    const t = await task(c, taskId);
    if (["COMPLETED", "CANCELLED"].includes(t.status))
      throw new Problem("已結束的任務不能改期");
    const previous = (
      await c.query("SELECT * FROM plans WHERE task_id=$1", [taskId])
    ).rows[0];
    const linked =
      b.level === "FIXED" &&
      (b.remind_at_start ??
        (previous.level === "FIXED" ? previous.remind_at_start : true));
    await c.query(
      "UPDATE plans SET level=$2,on_date=$3,fixed_time=$4,remind_at_start=$5 WHERE task_id=$1",
      [taskId, b.level, on, b.level === "FIXED" ? b.fixed_time : null, linked],
    );
    if (!["DAY", "FIXED"].includes(b.level) || on !== t.priority_date)
      await c.query("UPDATE tasks SET priority_date=NULL WHERE id=$1", [taskId]);
  });
  res.json({ ok: true });
});

app.put("/api/tasks/:id/priority", async (req, res) => {
  const taskId = id.parse(req.params.id);
  const b = z.object({ priority_date: date.nullable() }).parse(req.body);
  await tx(async (c) => {
    const t = await task(c, taskId);
    if (["COMPLETED", "CANCELLED"].includes(t.status))
      throw new Problem("已結束的任務不能調整優先順序");
    if (b.priority_date) {
      const plan = (
        await c.query("SELECT level,on_date FROM plans WHERE task_id=$1", [taskId])
      ).rows[0];
      if (!plan || !["DAY", "FIXED"].includes(plan.level) || plan.on_date !== b.priority_date)
        throw new Problem("只能置頂今天已安排的任務");
    }
    await c.query("UPDATE tasks SET priority_date=$2,updated_at=clock_timestamp() WHERE id=$1", [
      taskId,
      b.priority_date,
    ]);
  });
  res.json({ ok: true });
});

app.post("/api/tasks/:id/copy", async (req, res) => {
  const taskId = id.parse(req.params.id);
  const b = z
    .object({
      mode: z.enum(["follow-up", "again"]),
      title: taskInput.shape.title.optional(),
    })
    .parse(req.body);
  if (b.mode === "follow-up" && !b.title)
    throw new Problem("請輸入後續任務名稱");
  const result = await tx(async (c) => {
    const original = await task(c, taskId);
    if (original.status !== "COMPLETED") throw new Problem("請先完成原任務");
    const again = b.mode === "again";
    const copy = (
      await c.query(
        "INSERT INTO tasks(title,subject_id,topic_id,estimated,remaining,is_review,bucket) VALUES($1,$2,$3,$4,COALESCE($4::double precision,0),$5,$6) RETURNING *",
        [
          again ? original.title : b.title,
          original.subject_id,
          original.topic_id,
          again ? original.estimated : null,
          again ? original.is_review : true,
          original.bucket,
        ],
      )
    ).rows[0];
    await c.query("INSERT INTO plans(task_id,level) VALUES($1,'UNSCHEDULED')", [
      copy.id,
    ]);
    return copy;
  });
  res.status(201).json(result);
});
export default app;
