import { Router } from "express";
import { z } from "zod";
import { addDays, isoDay, weekStart } from "../../shared/domain.ts";
import { pool } from "../db.ts";
const app = Router();
const query = z.object({
  period: z.enum(["all", "week", "month"]).default("all"),
  subject: z.string().uuid().optional(),
  task: z.string().uuid().optional(),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});
function bounds(period: string) {
  const day = isoDay();
  return period === "week"
    ? [weekStart(day), addDays(weekStart(day), 7)]
    : period === "month"
      ? [
          day.slice(0, 7) + "-01",
          addDays(day.slice(0, 7) + "-01", 32).slice(0, 7) + "-01",
        ]
      : [null, null];
}
app.get("/api/history/tasks", async (req, res) => {
  const q = query.parse(req.query),
    [from, to] = bounds(q.period);
  const rows = (
    await pool.query(
      `SELECT e.*,t.title,t.subject_id,t.status,t.completed_at,t.cancelled_at FROM task_events e JOIN tasks t ON t.id=e.task_id WHERE ($1::uuid IS NULL OR t.subject_id=$1) AND ($2::uuid IS NULL OR t.id=$2) AND ($3::timestamptz IS NULL OR e.occurred_at>=$3) AND ($4::timestamptz IS NULL OR e.occurred_at<$4) ORDER BY e.occurred_at DESC,e.id DESC LIMIT $5 OFFSET $6`,
      [
        q.subject || null,
        q.task || null,
        from ? from + "T00:00:00+08:00" : null,
        to ? to + "T00:00:00+08:00" : null,
        q.limit + 1,
        q.offset,
      ],
    )
  ).rows;
  const month = bounds("month");
  const completed = Number(
    (
      await pool.query(
        "SELECT COUNT(*) FROM tasks WHERE completed_at>=$1 AND completed_at<$2 AND ($3::uuid IS NULL OR subject_id=$3)",
        [
          month[0] + "T00:00:00+08:00",
          month[1] + "T00:00:00+08:00",
          q.subject || null,
        ],
      )
    ).rows[0].count,
  );
  res.json({
    items: rows.slice(0, q.limit),
    hasMore: rows.length > q.limit,
    completedThisMonth: completed,
  });
});
app.get("/api/history/reviews", async (req, res) => {
  const q = query.parse(req.query),
    [from, to] = bounds(q.period);
  const rows = (
    await pool.query(
      `SELECT * FROM reviews WHERE ($1::uuid IS NULL OR subject_id=$1) AND ($2::timestamptz IS NULL OR reviewed_at>=$2) AND ($3::timestamptz IS NULL OR reviewed_at<$3) ORDER BY reviewed_at DESC,id DESC LIMIT $4 OFFSET $5`,
      [
        q.subject || null,
        from ? from + "T00:00:00+08:00" : null,
        to ? to + "T00:00:00+08:00" : null,
        q.limit + 1,
        q.offset,
      ],
    )
  ).rows;
  res.json({ items: rows.slice(0, q.limit), hasMore: rows.length > q.limit });
});
app.get("/api/subjects/:id/reviews", async (req, res) => {
  const subject = z.string().uuid().parse(req.params.id);
  const latest = (
    await pool.query(
      "SELECT DISTINCT ON(topic_id) * FROM reviews WHERE subject_id=$1 ORDER BY topic_id,reviewed_at DESC,id DESC",
      [subject],
    )
  ).rows;
  const recent = (
    await pool.query(
      "SELECT * FROM reviews WHERE subject_id=$1 ORDER BY reviewed_at DESC,id DESC LIMIT 10",
      [subject],
    )
  ).rows;
  res.json({ latest, recent });
});
app.get("/api/history/archive", async (req, res) => {
  const q = query
    .extend({
      status: z.enum(["COMPLETED", "CANCELLED"]).optional(),
      legacy: z.enum(["true"]).optional(),
      search: z.string().trim().max(200).default(""),
    })
    .parse(req.query);
  const rows = (
    await pool.query(
      `SELECT * FROM tasks WHERE status IN ('COMPLETED','CANCELLED') AND ($1::text IS NULL OR status=$1) AND ($2::uuid IS NULL OR subject_id=$2) AND ($3::boolean=false OR (completed_at IS NULL AND cancelled_at IS NULL)) AND ($6::text='' OR strpos(lower(title),lower($6))>0) ORDER BY COALESCE(completed_at,cancelled_at,created_at) DESC,id DESC LIMIT $4 OFFSET $5`,
      [
        q.status || null,
        q.subject || null,
        !!q.legacy,
        q.limit + 1,
        q.offset,
        q.search,
      ],
    )
  ).rows;
  res.json({ items: rows.slice(0, q.limit), hasMore: rows.length > q.limit });
});
export default app;
