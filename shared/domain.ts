export type Status = "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type Level = "UNSCHEDULED" | "MONTH" | "WEEK" | "DAY" | "FIXED";
export type Bucket = "ENGLISH" | "FLEXIBLE";
export interface Subject {
  id: string;
  name: string;
  color: string;
}
export interface Topic {
  id: string;
  subject_id: string;
  name: string;
}
export interface Plan {
  task_id: string;
  level: Level;
  on_date: string | null;
  fixed_time: string | null;
  remind_at_start?: boolean;
}
export interface Task {
  id: string;
  title: string;
  subject_id: string | null;
  topic_id: string | null;
  estimated: number | null;
  remaining: number;
  status: Status;
  note: string;
  is_review: boolean;
  bucket: Bucket;
  routine_date: string | null;
  created_at: string;
  updated_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  priority_date: string | null;
}
export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
}
export interface Session {
  id: string;
  task_id: string;
  state: "RUNNING" | "PAUSED" | "STOPPED" | "COMPLETED";
  started_at: string;
  ended_at: string | null;
  elapsed_closed?: number;
}
export interface Interval {
  id: string;
  session_id: string;
  start_at: string;
  end_at: string | null;
}
export interface Review {
  id: string;
  subject_id: string;
  topic_id: string | null;
  session_id: string | null;
  reviewed_at: string;
  duration: number | null;
  source: "SESSION" | "MANUAL";
  note: string;
}
export interface Reminder {
  source?: "manual" | "fixed";
  id: string;
  task_id: string;
  due_at: string;
  delivered_at: string | null;
  error: string | null;
  status: "pending" | "sending" | "delivered" | "error";
  accepted_at: string | null;
}
export interface Routine {
  days: { english: number; flexible: number; start: string }[];
}
export interface Snapshot {
  subjects: Subject[];
  topics: Topic[];
  tasks: Task[];
  plans: Plan[];
  subtasks: Subtask[];
  sessions: Session[];
  intervals: Interval[];
  reviews: Review[];
  reminders: Reminder[];
  totals?: Record<string, { total: number; today: number; day: string }>;
  routine: Routine;
  locale: "zh-Hant" | "en";
  now: string;
  pushKey: string | null;
}
export const labels = {
  TODO: "待開始",
  IN_PROGRESS: "進行中",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
  UNSCHEDULED: "未安排",
  MONTH: "本月",
  WEEK: "本週",
  DAY: "某一天",
  FIXED: "指定時間",
};
export const isoDay = (d: Date | string = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(d));
export const dayStart = (day: string) =>
  new Date(`${day}T00:00:00+08:00`).getTime();
export function addDays(day: string, n: number) {
  return isoDay(new Date(dayStart(day) + n * 86400000));
}
export function weekStart(day: string) {
  const n = new Date(`${day}T12:00:00+08:00`).getUTCDay();
  return addDays(day, -((n + 6) % 7));
}
export function planIncludes(p: Plan, day: string) {
  return p.level === "MONTH"
    ? p.on_date?.slice(0, 7) === day.slice(0, 7)
    : p.level === "WEEK"
      ? p.on_date === weekStart(day)
      : (p.level === "DAY" || p.level === "FIXED") && p.on_date === day;
}
export function intervalSeconds(i: Interval, now: number, day?: string) {
  let a = new Date(i.start_at).getTime(),
    b = i.end_at ? new Date(i.end_at).getTime() : now;
  if (day) {
    a = Math.max(a, dayStart(day));
    b = Math.min(b, dayStart(day) + 86400000);
  }
  return Math.max(0, b - a) / 1000;
}
export function taskActual(
  s: Snapshot,
  taskId: string,
  now: number,
  day?: string,
) {
  const ids = new Set(
    s.sessions.filter((x) => x.task_id === taskId).map((x) => x.id),
  );
  const saved = s.totals?.[taskId];
  const base = saved
    ? day
      ? saved.day === day
        ? saved.today
        : 0
      : saved.total
    : 0;
  return (
    base +
    s.intervals
      .filter((x) => ids.has(x.session_id))
      .reduce((n, i) => n + intervalSeconds(i, now, day), 0) /
      60
  );
}
export function taskRemaining(s: Snapshot, t: Task, now: number) {
  const ids = new Set(
    s.sessions.filter((x) => x.task_id === t.id).map((x) => x.id),
  );
  const live = s.intervals
    .filter((x) => ids.has(x.session_id) && !x.end_at)
    .reduce((n, i) => n + intervalSeconds(i, now) / 60, 0);
  return Math.max(0, t.remaining - live);
}
export function capacity(
  s: Snapshot,
  day: string,
  bucket: Bucket,
  now: number,
) {
  const routine = s.routine.days[new Date(`${day}T12:00:00+08:00`).getUTCDay()];
  const total = bucket === "ENGLISH" ? routine.english : routine.flexible;
  const tasks = s.tasks.filter((t) => t.bucket === bucket);
  const planned = tasks.filter(
    (t) =>
      s.plans.some(
        (p) =>
          p.task_id === t.id &&
          (p.level === "DAY" || p.level === "FIXED") &&
          p.on_date === day,
      ) && t.status !== "CANCELLED",
  );
  const actual = tasks.reduce((n, t) => n + taskActual(s, t.id, now, day), 0);
  const pending = planned
    .filter((t) => t.status !== "COMPLETED")
    .reduce((n, t) => n + taskRemaining(s, t, now), 0);
  // Routine reserves English without creating a task. Once started, its task carries the remainder.
  const implicit =
    bucket === "ENGLISH" && !planned.some((t) => t.routine_date === day)
      ? Math.max(0, total - actual - pending)
      : 0;
  const used = actual + pending + implicit;
  return {
    total,
    actual,
    implicit,
    pending: pending + implicit,
    used,
    remaining: Math.max(0, total - used),
    over: Math.max(0, used - total),
    planned,
  };
}
export function finishEstimate(s: Snapshot, day: string, now: number) {
  const r = s.routine.days[new Date(`${day}T12:00:00+08:00`).getUTCDay()];
  let cursor = Math.max(new Date(`${day}T${r.start}:00+08:00`).getTime(), now);
  const collisions: string[] = [];
  const open = s.tasks.filter(
    (t) =>
      !["COMPLETED", "CANCELLED"].includes(t.status) &&
      s.plans.some(
        (p) =>
          p.task_id === t.id &&
          p.on_date === day &&
          ["DAY", "FIXED"].includes(p.level),
      ),
  );
  const fixed = open
    .filter((t) => s.plans.find((p) => p.task_id === t.id)?.level === "FIXED")
    .sort((a, b) =>
      s.plans
        .find((p) => p.task_id === a.id)!
        .fixed_time!.localeCompare(
          s.plans.find((p) => p.task_id === b.id)!.fixed_time!,
        ),
    );
  let flexible =
    open
      .filter((t) => !fixed.includes(t))
      .reduce((n, t) => n + taskRemaining(s, t, now), 0) * 60000;
  const eng = capacity(s, day, "ENGLISH", now);
  flexible +=
    Math.max(
      0,
      eng.pending -
        open
          .filter((t) => t.bucket === "ENGLISH")
          .reduce((n, t) => n + taskRemaining(s, t, now), 0),
    ) * 60000;
  for (const t of fixed) {
    const p = s.plans.find((p) => p.task_id === t.id)!;
    const start = new Date(`${day}T${p.fixed_time}:00+08:00`).getTime();
    const gap = Math.max(0, start - cursor);
    const fill = Math.min(gap, flexible);
    cursor += fill;
    flexible -= fill;
    if (cursor > start) collisions.push(t.title);
    cursor = Math.max(cursor, start) + taskRemaining(s, t, now) * 60000;
  }
  return { at: new Date(cursor + flexible).toISOString(), collisions };
}
export function latestReviews(
  reviews: Review[],
  subjectId: string,
  topicId?: string,
) {
  return (
    reviews
      .filter(
        (r) =>
          r.subject_id === subjectId && (!topicId || r.topic_id === topicId),
      )
      .sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at))[0] ?? null
  );
}
export const fmtMin = (n: number) =>
  n > 0 && n < 0.1 ? "<0.1" : `${Math.round(n * 10) / 10}`;
