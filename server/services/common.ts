import type { PoolClient } from "pg";
import { z } from "zod";
import type { Session, Task } from "../../shared/domain.ts";
export const id = z.string().uuid();
export const title = z.string().trim().min(1).max(200);
export const minutes = z.number().min(0).max(1440);
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
  );
export const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const instant = z.string().datetime({ offset: true });
export const taskInput = z.object({
  title,
  subject_id: id.nullable().default(null),
  topic_id: id.nullable().default(null),
  estimated: minutes.positive().nullable().default(null),
  note: z.string().max(2000).default(""),
  is_review: z.boolean().default(true),
  bucket: z.enum(["ENGLISH", "FLEXIBLE"]).default("FLEXIBLE"),
  subtasks: z.array(title).max(30).default([]),
});
export const planInput = z.object({
  level: z.enum(["UNSCHEDULED", "MONTH", "WEEK", "DAY", "FIXED"]),
  on_date: date.nullable().default(null),
  fixed_time: clock.nullable().default(null),
  remind_at_start: z.boolean().optional(),
});
export class Problem extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export async function task(c: PoolClient, taskId: string) {
  const t = (
    await c.query("SELECT * FROM tasks WHERE id=$1 FOR UPDATE", [taskId])
  ).rows[0] as Task | undefined;
  if (!t) throw new Problem("找不到任務", 404);
  return t;
}
export async function closeInterval(c: PoolClient, s: Session, at: Date) {
  const result = await c.query(
    "UPDATE intervals SET end_at=$2 WHERE session_id=$1 AND end_at IS NULL RETURNING EXTRACT(EPOCH FROM(end_at-start_at))/60 AS minutes",
    [s.id, at],
  );
  const elapsed = Number(result.rows[0]?.minutes ?? 0);
  if (elapsed)
    await c.query(
      "UPDATE tasks SET remaining=GREATEST(0,remaining-$2) WHERE id=$1",
      [s.task_id, elapsed],
    );
}
export async function recordReview(
  c: PoolClient,
  s: Session,
  t: Task,
  at: Date,
) {
  if (!t.is_review || !t.subject_id) return;
  const duration = Number(
    (
      await c.query(
        "SELECT COALESCE(SUM(EXTRACT(EPOCH FROM(end_at-start_at))/60),0) AS n FROM intervals WHERE session_id=$1",
        [s.id],
      )
    ).rows[0].n,
  );
  if (duration > 0)
    await c.query(
      "INSERT INTO reviews(subject_id,topic_id,session_id,reviewed_at,duration,source) VALUES($1,$2,$3,$4,$5,'SESSION') ON CONFLICT(session_id) DO NOTHING",
      [t.subject_id, t.topic_id, s.id, at, duration],
    );
}
