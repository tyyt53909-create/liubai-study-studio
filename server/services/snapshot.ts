import type { PoolClient } from "pg";
import { addDays, isoDay, weekStart } from "../../shared/domain.ts";
export async function snapshot(c: PoolClient, selected?: string) {
  const day = isoDay(),
    start = `${day}T00:00:00+08:00`,
    end = `${addDays(day, 1)}T00:00:00+08:00`;
  const tasks = (
    await c.query(
      `SELECT t.* FROM tasks t LEFT JOIN plans p ON p.task_id=t.id WHERE
 t.status IN ('TODO','IN_PROGRESS') OR t.id=$1 OR
 (p.level IN ('DAY','FIXED') AND p.on_date>=$2 AND p.on_date<$3) OR EXISTS
 (SELECT 1 FROM sessions s JOIN intervals i ON i.session_id=s.id WHERE s.task_id=t.id AND i.start_at<$5 AND (i.end_at IS NULL OR i.end_at>$4)) ORDER BY t.created_at,t.id`,
      [
        selected || null,
        weekStart(day),
        addDays(weekStart(day), 7),
        start,
        end,
      ],
    )
  ).rows;
  const ids = tasks.map((t) => t.id);
  const sessions = (
    await c.query(
      `SELECT s.*,COALESCE((SELECT SUM(EXTRACT(EPOCH FROM(i.end_at-i.start_at))) FROM intervals i WHERE i.session_id=s.id AND i.end_at IS NOT NULL),0)::float8 AS elapsed_closed FROM sessions s WHERE state IN ('RUNNING','PAUSED')`,
    )
  ).rows;
  const intervals = (
    await c.query("SELECT i.* FROM intervals i WHERE i.end_at IS NULL")
  ).rows;
  const totals = (
    await c.query(
      `SELECT s.task_id,COALESCE(SUM(EXTRACT(EPOCH FROM(i.end_at-i.start_at)))/60,0)::float8 AS total,
 COALESCE(SUM(GREATEST(0,EXTRACT(EPOCH FROM(LEAST(i.end_at,$3::timestamptz)-GREATEST(i.start_at,$2::timestamptz)))))/60,0)::float8 AS today
 FROM sessions s JOIN intervals i ON i.session_id=s.id WHERE s.task_id=ANY($1::uuid[]) AND i.end_at IS NOT NULL GROUP BY s.task_id`,
      [ids, start, end],
    )
  ).rows;
  return {
    now: new Date().toISOString(),
    pushKey: process.env.VAPID_PUBLIC_KEY || null,
    subjects: (await c.query("SELECT * FROM subjects ORDER BY name")).rows,
    topics: (await c.query("SELECT * FROM topics ORDER BY name")).rows,
    tasks,
    plans: (
      await c.query("SELECT * FROM plans WHERE task_id=ANY($1::uuid[])", [ids])
    ).rows,
    subtasks: (
      await c.query(
        "SELECT * FROM subtasks WHERE task_id=ANY($1::uuid[]) ORDER BY position",
        [ids],
      )
    ).rows,
    reminders: (
      await c.query(
        "SELECT id,task_id,due_at,delivered_at,error,status,accepted_at,source FROM reminders WHERE task_id=ANY($1::uuid[])",
        [ids],
      )
    ).rows,
    sessions,
    intervals,
    reviews: [],
    totals: Object.fromEntries(
      totals.map((t) => [t.task_id, { total: t.total, today: t.today, day }]),
    ),
    ...(await (async () => {
      const settings = (await c.query("SELECT routine,locale FROM settings WHERE id=1")).rows[0];
      return {
        routine: settings.routine,
        locale: settings.locale === "en" ? "en" : "zh-Hant",
      };
    })()),
  };
}
