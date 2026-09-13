import assert from "node:assert/strict";
import { test } from "node:test";
import type { Snapshot, Task } from "../shared/domain.ts";
import {
  capacity,
  finishEstimate,
  isoDay,
  latestReviews,
  taskActual,
  taskRemaining,
  weekStart,
} from "../shared/domain.ts";
const day = "2026-09-07",
  now = Date.parse(day + "T18:00:00+08:00");
const task = (id: string, estimated: number): Task => ({
  id,
  title: id,
  subject_id: "chinese",
  topic_id: null,
  estimated,
  remaining: estimated,
  status: "TODO",
  note: "",
  is_review: true,
  bucket: "FLEXIBLE",
  routine_date: null,
  created_at: new Date(now).toISOString(),
  updated_at: null,
  completed_at: null,
  cancelled_at: null,
  priority_date: null,
});
function base(): Snapshot {
  return {
    subjects: [],
    topics: [],
    tasks: [],
    plans: [],
    sessions: [],
    intervals: [],
    subtasks: [],
    reviews: [],
    reminders: [],
    routine: {
      days: Array.from({ length: 7 }, () => ({
        english: 120,
        flexible: 120,
        start: "18:00",
      })),
    },
    locale: "zh-Hant",
    now: new Date(now).toISOString(),
    pushKey: null,
  };
}
function add(s: Snapshot, t: Task) {
  s.tasks.push(t);
  s.plans.push({ task_id: t.id, level: "DAY", on_date: day, fixed_time: null });
}
test("C: 120 capacity: 40+60 -> 100/20, +30 ->130/10", () => {
  const s = base();
  add(s, task("A", 40));
  add(s, task("B", 60));
  assert.equal(capacity(s, day, "FLEXIBLE", now).used, 100);
  assert.equal(capacity(s, day, "FLEXIBLE", now).remaining, 20);
  add(s, task("C", 30));
  assert.equal(capacity(s, day, "FLEXIBLE", now).over, 10);
});
test("F: completed 40 estimate / 27 actual saves 13 and restores capacity", () => {
  const s = base(),
    t = task("A", 40);
  t.status = "COMPLETED";
  t.remaining = 0;
  add(s, t);
  s.sessions.push({
    id: "s",
    task_id: "A",
    state: "COMPLETED",
    started_at: new Date(now - 27 * 60000).toISOString(),
    ended_at: new Date(now).toISOString(),
  });
  s.intervals.push({
    id: "i",
    session_id: "s",
    start_at: new Date(now - 27 * 60000).toISOString(),
    end_at: new Date(now).toISOString(),
  });
  assert.equal(t.estimated! - taskActual(s, t.id, now), 13);
  assert.equal(capacity(s, day, "FLEXIBLE", now).remaining, 93);
  s.intervals[0].start_at = new Date(now - 53 * 60000).toISOString();
  assert.equal(taskActual(s, t.id, now) - t.estimated!, 13);
  assert.equal(capacity(s, day, "FLEXIBLE", now).remaining, 67);
});
test("E: live interval deducted once, prior days actual excluded and pause gap excluded", () => {
  const s = base(),
    t = task("A", 60);
  t.remaining = 40;
  t.status = "IN_PROGRESS";
  add(s, t);
  s.sessions.push({
    id: "s",
    task_id: "A",
    state: "RUNNING",
    started_at: "2026-09-06T23:50:00+08:00",
    ended_at: null,
  });
  s.intervals.push(
    {
      id: "a",
      session_id: "s",
      start_at: "2026-09-06T23:50:00+08:00",
      end_at: "2026-09-07T00:10:00+08:00",
    },
    {
      id: "b",
      session_id: "s",
      start_at: "2026-09-07T17:45:00+08:00",
      end_at: null,
    },
  );
  assert.equal(taskActual(s, "A", now), 35);
  assert.equal(taskActual(s, "A", now, day), 25);
  assert.equal(taskRemaining(s, t, now), 25);
  assert.equal(capacity(s, day, "FLEXIBLE", now).used, 50);
});
test("H: routine independent of task, not double counted; flexible unaffected", () => {
  const s = base();
  assert.equal(capacity(s, day, "ENGLISH", now).used, 120);
  const t = {
    ...task("eng", 120),
    bucket: "ENGLISH" as const,
    routine_date: day,
  };
  add(s, t);
  assert.equal(capacity(s, day, "ENGLISH", now).used, 120);
  assert.equal(capacity(s, day, "FLEXIBLE", now).used, 0);
});
test("B: Hong Kong midnight/week boundaries use local date", () => {
  assert.equal(isoDay("2026-09-06T16:05:00Z"), day);
  assert.equal(weekStart("2026-09-06"), "2026-08-31");
  assert.equal(weekStart("2026-09-07"), day);
});
test("G: subject latest is Sep5 while Writing remains Sep1", () => {
  const s = base();
  s.reviews = [
    {
      id: "1",
      subject_id: "Chinese",
      topic_id: "Writing",
      session_id: null,
      reviewed_at: "2026-09-01T10:00:00Z",
      duration: 30,
      source: "MANUAL",
      note: "",
    },
    {
      id: "2",
      subject_id: "Chinese",
      topic_id: "Classical Chinese",
      session_id: null,
      reviewed_at: "2026-09-05T10:00:00Z",
      duration: 30,
      source: "MANUAL",
      note: "",
    },
  ];
  assert.equal(latestReviews(s.reviews, "Chinese")?.id, "2");
  assert.equal(latestReviews(s.reviews, "Chinese", "Writing")?.id, "1");
  assert.equal(
    latestReviews(s.reviews, "Chinese", "Classical Chinese")?.id,
    "2",
  );
});
test("finish estimate anchors to start/now, respects fixed time and detects conflicts", () => {
  const s = base();
  s.routine.days.forEach((d) => (d.english = 0));
  add(s, task("a", 40));
  assert.equal(
    finishEstimate(s, day, now).at,
    new Date(now + 40 * 60000).toISOString(),
  );
  add(s, task("fixed", 30));
  s.plans[1] = {
    task_id: "fixed",
    level: "FIXED",
    on_date: day,
    fixed_time: "19:00",
  };
  assert.equal(finishEstimate(s, day, now).at, "2026-09-07T11:30:00.000Z");
  s.plans[1].fixed_time = "17:00";
  assert.deepEqual(finishEstimate(s, day, now).collisions, ["fixed"]);
});

test("fixed English reserves only the unallocated remainder for custom tasks", () => {
  const s = base();
  add(s, { ...task("custom", 40), bucket: "ENGLISH" });
  assert.equal(capacity(s, day, "ENGLISH", now).implicit, 80);
  add(s, { ...task("routine", 80), bucket: "ENGLISH", routine_date: day });
  assert.equal(capacity(s, day, "ENGLISH", now).used, 120);
  assert.equal(capacity(s, day, "ENGLISH", now).implicit, 0);
});
