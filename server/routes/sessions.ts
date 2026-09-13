import { Router } from "express";
import { z } from "zod";
import type { Session } from "../../shared/domain.ts";
import { isoDay } from "../../shared/domain.ts";
import { tx } from "../db.ts";
import {
  closeInterval,
  id,
  Problem,
  recordReview,
  task,
} from "../services/common.ts";
const app = Router();
app.post("/api/tasks/:id/action", async (req, res) => {
  const taskId = id.parse(req.params.id);
  const { action } = z
    .object({
      action: z.enum([
        "start",
        "pause",
        "resume",
        "stop",
        "complete",
        "cancel",
      ]),
    })
    .parse(req.body);
  const result = await tx(async (c) => {
    const t = await task(c, taskId);
    const at = new Date();
    const active = (
      await c.query(
        "SELECT * FROM sessions WHERE state IN ('RUNNING','PAUSED')",
      )
    ).rows[0] as Session | undefined;
    if (t.status === "COMPLETED" || t.status === "CANCELLED") {
      if (
        (action === "complete" && t.status === "COMPLETED") ||
        (action === "cancel" && t.status === "CANCELLED")
      )
        return { ok: true };
      throw new Problem("此任務已結束");
    }
    if (action === "start" || action === "resume") {
      const today = isoDay(at);
      await c.query(
        "UPDATE plans SET level='DAY',on_date=$2,fixed_time=NULL,remind_at_start=false WHERE task_id=$1 AND NOT(level IN ('DAY','FIXED') AND on_date=$2)",
        [taskId, today],
      );
      if (active) {
        if (active.task_id !== taskId)
          throw new Problem("請先暫時停止目前的學習，再開始另一個任務");
        if (active.state === "RUNNING") return { ok: true };
        await c.query("UPDATE sessions SET state='RUNNING' WHERE id=$1", [
          active.id,
        ]);
        await c.query(
          "INSERT INTO intervals(session_id,start_at) VALUES($1,$2)",
          [active.id, at],
        );
      } else {
        const s = (
          await c.query(
            "INSERT INTO sessions(task_id,state,started_at) VALUES($1,'RUNNING',$2) RETURNING *",
            [taskId, at],
          )
        ).rows[0];
        await c.query(
          "INSERT INTO intervals(session_id,start_at) VALUES($1,$2)",
          [s.id, at],
        );
      }
      await c.query("UPDATE tasks SET status='IN_PROGRESS' WHERE id=$1", [
        taskId,
      ]);
      return { ok: true };
    }
    if (action === "complete") {
      const n = Number(
        (
          await c.query(
            "SELECT COUNT(*) FROM subtasks WHERE task_id=$1 AND NOT completed",
            [taskId],
          )
        ).rows[0].count,
      );
      if (n) throw new Problem("還有未完成的子項，請先勾選或選擇「暫時停止」");
    }
    if (action === "pause" || action === "stop") {
      if (!active || active.task_id !== taskId) return { ok: true };
    }
    if (active?.task_id === taskId) {
      await closeInterval(c, active, at);
      const state =
        action === "pause"
          ? "PAUSED"
          : action === "complete"
            ? "COMPLETED"
            : "STOPPED";
      await c.query("UPDATE sessions SET state=$2,ended_at=$3 WHERE id=$1", [
        active.id,
        state,
        state === "PAUSED" ? null : at,
      ]);
      if (action !== "pause") await recordReview(c, active, t, at);
    }
    if (action === "complete" || action === "cancel") {
      await c.query(
        "UPDATE tasks SET status=$2,remaining=CASE WHEN $2='COMPLETED' THEN 0 ELSE remaining END WHERE id=$1",
        [taskId, action === "complete" ? "COMPLETED" : "CANCELLED"],
      );
      await c.query(
        "DELETE FROM reminders WHERE task_id=$1 AND delivered_at IS NULL",
        [taskId],
      );
    }
    return { ok: true };
  });
  res.json(result);
});

export default app;
