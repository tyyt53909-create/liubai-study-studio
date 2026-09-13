import assert from "node:assert/strict";
import { after, test } from "node:test";
import pg from "pg";
import { capacity, isoDay, taskActual } from "../shared/domain.ts";
pg.types.setTypeParser(1082, (v) => v);
const base = process.env.TEST_URL || "http://localhost:4318";
const db = new pg.Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ||
    "postgres://study:study_local@localhost:55439/study_test",
});
after(() => db.end());
let cookie = "";
async function login() {
  const r = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: process.env.TEST_PASSWORD }),
  });
  assert.equal(r.status, 200);
  cookie = r.headers.get("set-cookie")!.split(";")[0];
}

async function call(
  path: string,
  method = "GET",
  body?: unknown,
  status = 200,
) {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await r.json();
  assert.equal(r.status, status, JSON.stringify(result));
  if (path === "/state") {
    // v0.1 mutation regression assertions inspect persisted rows independently of the bounded wire snapshot.
    for (const table of [
      "tasks",
      "plans",
      "sessions",
      "intervals",
      "reviews",
      "subtasks",
      "reminders",
    ])
      result[table] = (
        await db.query(
          `SELECT * FROM ${table}${table === "subtasks" ? " ORDER BY position" : ""}`,
        )
      ).rows;
    delete result.totals;
  }
  return result;
}
test("A–J real PostgreSQL API integration and session invariants", async () => {
  assert.equal(
    (await db.query("SELECT current_database() AS name")).rows[0].name,
    "study_test",
  );
  await login();
  await db.query("TRUNCATE tasks,reviews CASCADE");
  const state = await call("/state");
  const subject = state.subjects.find((x: any) => x.name === "Chinese");
  const prefix = "API-" + Date.now();
  const make = (name: string, estimated = 60, extras = {}) =>
    call(
      "/tasks",
      "POST",
      {
        title: prefix + " " + name,
        subject_id: subject.id,
        estimated,
        ...extras,
      },
      201,
    );
  const t = await make("partial", 60, { subtasks: ["甲", "乙", "丙"] });
  let s = await call("/state");
  assert.equal(
    s.plans.find((p: any) => p.task_id === t.id).level,
    "UNSCHEDULED",
  );
  assert.equal(t.topic_id, null);
  for (const level of ["MONTH", "WEEK", "DAY", "FIXED", "UNSCHEDULED"]) {
    await call("/tasks/" + t.id + "/plan", "PUT", {
      level,
      on_date: "2026-09-07",
      fixed_time: "20:00",
    });
    s = await call("/state");
    assert.equal(s.plans.find((p: any) => p.task_id === t.id).level, level);
  }
  await call("/tasks/" + t.id + "/plan", "PUT", {
    level: "DAY",
    on_date: isoDay(),
  });
  await call("/tasks/" + t.id + "/priority", "PUT", {
    priority_date: isoDay(),
  });
  s = await call("/state");
  assert.equal(s.tasks.find((x: any) => x.id === t.id).priority_date, isoDay());
  await call("/tasks/" + t.id + "/priority", "PUT", { priority_date: null });
  await call("/tasks/" + t.id + "/action", "POST", { action: "start" });
  await call("/tasks/" + t.id + "/action", "POST", { action: "start" });
  s = await call("/state");
  let sessions = s.sessions.filter((x: any) => x.task_id === t.id);
  assert.equal(sessions.length, 1);
  const sid = sessions[0].id;
  await db.query(
    "UPDATE intervals SET start_at=$2 WHERE session_id=$1 AND end_at IS NULL",
    [sid, new Date(Date.now() - 35 * 60000)],
  );
  await call("/tasks/" + t.id + "/action", "POST", { action: "pause" });
  s = await call("/state");
  const actual = taskActual(s, t.id, Date.now());
  assert.ok(actual >= 35 && actual < 35.1);
  assert.equal(s.reviews.filter((r: any) => r.session_id === sid).length, 0);
  assert.ok(s.tasks.find((x: any) => x.id === t.id).remaining <= 25);
  await call("/tasks/" + t.id + "/action", "POST", { action: "pause" });
  s = await call("/state");
  assert.equal(taskActual(s, t.id, Date.now()), actual);
  const other = await make("other");
  await call(
    "/tasks/" + other.id + "/action",
    "POST",
    { action: "start" },
    400,
  );
  const sub = s.subtasks.filter((x: any) => x.task_id === t.id);
  assert.deepEqual(
    sub.map((x: any) => x.title),
    ["甲", "乙", "丙"],
  );
  for (const x of sub.slice(0, 2))
    await call("/subtasks/" + x.id, "PATCH", { completed: true });
  await call("/tasks/" + t.id + "/action", "POST", { action: "complete" }, 400);
  await call("/tasks/" + t.id + "/action", "POST", { action: "resume" });
  await call("/tasks/" + t.id + "/action", "POST", { action: "stop" });
  await call("/tasks/" + t.id + "/action", "POST", { action: "stop" });
  s = await call("/state");
  assert.equal(s.tasks.find((x: any) => x.id === t.id).status, "IN_PROGRESS");
  assert.equal(s.reviews.filter((r: any) => r.session_id === sid).length, 1);
  await call("/tasks/" + t.id, "PATCH", { remaining: 33 });
  await call("/tasks/" + t.id + "/action", "POST", { action: "start" });
  await call("/subtasks/" + sub[2].id, "PATCH", { completed: true });
  await call("/tasks/" + t.id + "/action", "POST", { action: "complete" });
  await call("/tasks/" + t.id + "/action", "POST", { action: "complete" });
  s = await call("/state");
  assert.equal(s.tasks.find((x: any) => x.id === t.id).status, "COMPLETED");
  assert.equal(s.tasks.find((x: any) => x.id === t.id).remaining, 0);
  assert.equal(s.sessions.filter((x: any) => x.task_id === t.id).length, 2);
  await call("/tasks/" + other.id + "/reminder", "PUT", {
    due_at: new Date(Date.now() + 60000).toISOString(),
  });
  await call("/tasks/" + other.id + "/action", "POST", { action: "cancel" });
  s = await call("/state");
  assert.equal(s.tasks.find((x: any) => x.id === other.id).status, "CANCELLED");
  assert.equal(
    s.reminders.filter((r: any) => r.task_id === other.id).length,
    0,
  );
  const noReview = await make("non-review", 40, { is_review: false });
  await call("/tasks/" + noReview.id + "/action", "POST", { action: "start" });
  s = await call("/state");
  const ns = s.sessions.find((x: any) => x.task_id === noReview.id);
  assert.equal(
    s.plans.find((x: any) => x.task_id === noReview.id).level,
    "DAY",
  );
  assert.equal(
    s.plans.find((x: any) => x.task_id === noReview.id).on_date,
    isoDay(),
  );
  await db.query("UPDATE intervals SET start_at=$2 WHERE session_id=$1", [
    ns.id,
    new Date(Date.now() - 27 * 60000),
  ]);
  await call("/tasks/" + noReview.id + "/action", "POST", {
    action: "complete",
  });
  s = await call("/state");
  assert.equal(s.reviews.filter((r: any) => r.session_id === ns.id).length, 0);
  assert.ok(Math.abs(40 - taskActual(s, noReview.id, Date.now()) - 13) < 0.1);
  const writing = state.topics.find(
      (x: any) => x.subject_id === subject.id && x.name === "Writing",
    ),
    classical = state.topics.find((x: any) => x.name === "Classical Chinese");
  for (const [topic, d] of [
    [writing, "2026-09-01"],
    [classical, "2026-09-05"],
  ])
    await call(
      "/reviews",
      "POST",
      {
        subject_id: subject.id,
        topic_id: topic.id,
        reviewed_at: d + "T10:00:00+08:00",
        duration: 30,
        note: prefix,
      },
      201,
    );
  await call(
    "/reviews",
    "POST",
    { subject_id: subject.id, reviewed_at: "2099-09-01T10:00:00+08:00" },
    400,
  );
  const mismatch = state.topics.find((x: any) => x.subject_id !== subject.id);
  await make("bad-topic", 30, { topic_id: mismatch.id })
    .then(() => assert.fail("must reject mismatched topic"))
    .catch((e) => assert.match(e.message, /400/));
  await call("/routine", "PUT", state.routine);
  if (
    state.routine.days[new Date(isoDay() + "T12:00:00+08:00").getUTCDay()]
      .english
  ) {
    const customEnglish = await make("custom English", 40, {
      subject_id: state.subjects.find((x: any) => x.name === "English").id,
      bucket: "ENGLISH",
    });
    await call("/tasks/" + customEnglish.id + "/plan", "PUT", {
      level: "DAY",
      on_date: isoDay(),
    });
    const r1 = await call("/routine/start", "POST", {}),
      r2 = await call("/routine/start", "POST", {});
    assert.equal(r1.id, r2.id);
    assert.equal(r1.estimated, 80);
    assert.equal(
      capacity(await call("/state"), isoDay(), "ENGLISH", Date.now()).used,
      120,
    );
  }
  const remind = await make("reminder");
  await call("/tasks/" + remind.id + "/reminder", "PUT", {
    due_at: new Date(Date.now() + 60000).toISOString(),
  });
  await db.query(
    "UPDATE reminders SET due_at=now()-interval '1 second' WHERE task_id=$1",
    [remind.id],
  );
  const due = await call("/reminders/claim", "POST", {
    deviceId: "12345678-1234-4234-8234-123456789abc",
  });
  const hit = due.find((x: any) => x.taskId === remind.id);
  assert.ok(hit);
  await call("/reminders/" + hit.id + "/ack", "POST", {
    claimToken: hit.claimToken,
  });
  assert.ok(
    !(
      await call("/reminders/claim", "POST", {
        deviceId: "12345678-1234-4234-8234-123456789abc",
      })
    ).find((x: any) => x.id === hit.id),
  );
  const cross = await fetch(base + "/api/tasks", {
    method: "POST",
    headers: {
      Origin: "https://attacker.invalid",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(cross.status, 403);
  await call(
    "/tasks/" + remind.id + "/plan",
    "PUT",
    { level: "DAY", on_date: "2026-02-31" },
    400,
  );
});

test("v0.2 task events, immutable history, access control and bounded loading", async () => {
  await login();
  const wire = () =>
    fetch(base + "/api/state", { headers: { Cookie: cookie } }).then((r) =>
      r.json(),
    );
  const initial = await wire();
  const subject = initial.subjects.find((s: any) => s.name === "Chinese");
  const t = await call(
    "/tasks",
    "POST",
    { title: "v02 history", subject_id: subject.id, estimated: 30 },
    201,
  );
  const events = async () => (await call("/history/tasks?task=" + t.id)).items;
  assert.equal(
    (await events()).filter((e: any) => e.kind === "CREATED").length,
    1,
  );
  for (const level of ["WEEK", "DAY", "FIXED"]) {
    const data = { level, on_date: isoDay(), fixed_time: "22:00" };
    await call("/tasks/" + t.id + "/plan", "PUT", data);
    await call("/tasks/" + t.id + "/plan", "PUT", data);
  }
  let e = await events();
  assert.equal(e.filter((x: any) => x.kind === "PLAN_CHANGED").length, 3);
  const earliest = e.filter((x: any) => x.kind === "PLAN_CHANGED").at(-1);
  assert.equal(earliest.before_plan.level, "UNSCHEDULED");
  assert.equal(earliest.after_plan.level, "WEEK");
  await call("/tasks/" + t.id + "/action", "POST", { action: "start" });
  await call("/tasks/" + t.id + "/action", "POST", { action: "start" });
  await call("/tasks/" + t.id + "/action", "POST", { action: "stop" });
  await db.query("UPDATE tasks SET created_at='2025-01-01' WHERE id=$1", [
    t.id,
  ]);
  const count = (await call("/history/tasks?period=month")).completedThisMonth;
  await Promise.all([
    call("/tasks/" + t.id + "/action", "POST", { action: "complete" }),
    call("/tasks/" + t.id + "/action", "POST", { action: "complete" }),
  ]);
  const completed = (await db.query("SELECT * FROM tasks WHERE id=$1", [t.id]))
    .rows[0];
  assert.ok(completed.completed_at);
  assert.ok(completed.updated_at);
  assert.equal(
    (await call("/history/tasks?period=month")).completedThisMonth,
    count + 1,
  );
  e = await events();
  for (const kind of [
    "CREATED",
    "SESSION_STARTED",
    "SESSION_STOPPED",
    "COMPLETED",
  ])
    assert.equal(e.filter((x: any) => x.kind === kind).length, 1, kind);
  await assert.rejects(
    db.query("UPDATE task_events SET kind='CANCELLED' WHERE task_id=$1", [
      t.id,
    ]),
    /immutable/,
  );
  const cancelled = await call(
    "/tasks",
    "POST",
    { title: "v02 cancel", subject_id: subject.id },
    201,
  );
  await call("/tasks/" + cancelled.id + "/action", "POST", {
    action: "cancel",
  });
  await call("/tasks/" + cancelled.id + "/action", "POST", {
    action: "cancel",
  });
  assert.ok(
    (
      await db.query("SELECT cancelled_at FROM tasks WHERE id=$1", [
        cancelled.id,
      ])
    ).rows[0].cancelled_at,
  );
  assert.equal(
    (await call("/history/tasks?task=" + cancelled.id)).items.filter(
      (x: any) => x.kind === "CANCELLED",
    ).length,
    1,
  );
  // Imported pre-v0.2 rows have unknown end timestamps; migrations must not invent one.
  await db.query("ALTER TABLE tasks DISABLE TRIGGER task_event");
  let legacy;
  try {
    legacy = (
      await db.query(
        "INSERT INTO tasks(title,subject_id,estimated,remaining,bucket,status,created_at) VALUES('legacy unknown',$1,30,0,'FLEXIBLE','COMPLETED','2025-01-01') RETURNING *",
        [subject.id],
      )
    ).rows[0];
  } finally {
    await db.query("ALTER TABLE tasks ENABLE TRIGGER task_event");
  }
  const { readFile } = await import("node:fs/promises");
  await db.query(
    await readFile("server/migrations/002-foundation.sql", "utf8"),
  );
  assert.equal(
    (await db.query("SELECT completed_at FROM tasks WHERE id=$1", [legacy.id]))
      .rows[0].completed_at,
    null,
  );
  assert.ok(
    (await call("/history/archive?legacy=true")).items.some(
      (x: any) => x.id === legacy.id,
    ),
  );
  // 18-month-shaped old review history does not enter a periodic snapshot.
  const before = await wire();
  await db.query(
    "INSERT INTO reviews(subject_id,reviewed_at,duration,source) SELECT $1,now()-interval '100 days'-n*interval '1 minute',30,'MANUAL' FROM generate_series(1,2000)n",
    [subject.id],
  );
  await db.query(
    "WITH created AS (INSERT INTO sessions(task_id,state,started_at,ended_at) SELECT $1,'STOPPED',now()-interval '100 days'-n*interval '1 hour',now()-interval '100 days'-n*interval '1 hour'+interval '30 minutes' FROM generate_series(1,2000)n RETURNING id,started_at,ended_at) INSERT INTO intervals(session_id,start_at,end_at) SELECT id,started_at,ended_at FROM created",
    [legacy.id],
  );
  const loadAt = performance.now();
  const after = await wire();
  console.log(
    "Bounded snapshot with 2000 old sessions/intervals/reviews:",
    JSON.stringify(after).length,
    "bytes,",
    Math.round(performance.now() - loadAt),
    "ms",
  );
  assert.equal(after.reviews.length, 0);
  assert.equal(after.sessions.length, 0);
  assert.equal(after.intervals.length, 0);
  assert.ok(JSON.stringify(after).length <= JSON.stringify(before).length + 50);
  const reviews = await call("/history/reviews?limit=30");
  assert.equal(reviews.items.length, 30);
  assert.equal(reviews.hasMore, true);
  assert.ok(
    (await call("/subjects/" + subject.id + "/reviews")).recent.length <= 10,
  );
  const page = await call("/history/tasks?limit=2");
  assert.equal(page.items.length, 2);
  assert.equal(page.hasMore, true);
  for (const path of [
    "/state",
    "/history/tasks",
    "/history/reviews",
    "/subjects/" + subject.id + "/reviews",
  ])
    assert.equal((await fetch(base + "/api" + path)).status, 401);
  assert.equal(
    (
      await fetch(base + "/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    401,
  );
  const old = cookie;
  await call("/auth/logout", "POST", {});
  assert.equal(
    (await fetch(base + "/api/state", { headers: { Cookie: old } })).status,
    401,
  );
  await login();
});

test("v0.2 reminder claims race, retries and replacement", async () => {
  await login();
  const state = await call("/state");
  const subject = state.subjects[0];
  const t = await call(
    "/tasks",
    "POST",
    { title: "v02 claim race", subject_id: subject.id },
    201,
  );
  await call("/tasks/" + t.id + "/reminder", "PUT", {
    due_at: new Date(Date.now() + 60000).toISOString(),
  });
  await db.query(
    "UPDATE reminders SET due_at=now()-interval '1 second' WHERE task_id=$1",
    [t.id],
  );
  const devices = [
    "12345678-1234-4234-8234-123456789abc",
    "12345678-1234-4234-8234-123456789abd",
  ];
  const race = await Promise.all(
    devices.map((deviceId) => call("/reminders/claim", "POST", { deviceId })),
  );
  const claims = race.flat().filter((x: any) => x.taskId === t.id);
  assert.equal(claims.length, 1);
  const claim = claims[0];
  await call("/reminders/" + claim.id + "/validate", "POST", {
    claimToken: claim.claimToken,
  });
  await call(
    "/reminders/" + claim.id + "/ack",
    "POST",
    { claimToken: devices[0] },
    404,
  );
  await db.query(
    "UPDATE reminders SET claimed_at=now()-interval '1 minute' WHERE id=$1",
    [claim.id],
  );
  const winner =
    devices[race.findIndex((x) => x.some((r: any) => r.id === claim.id))];
  const retry = await call("/reminders/claim", "POST", { deviceId: winner });
  assert.equal(
    retry.find((x: any) => x.id === claim.id).claimToken,
    claim.claimToken,
  );
  await call("/reminders/" + claim.id + "/ack", "POST", {
    claimToken: claim.claimToken,
  });
  await call("/reminders/" + claim.id + "/ack", "POST", {
    claimToken: claim.claimToken,
  });
  assert.equal(
    (await db.query("SELECT status FROM reminders WHERE id=$1", [claim.id]))
      .rows[0].status,
    "delivered",
  );
  await call("/tasks/" + t.id + "/reminder", "PUT", {
    due_at: new Date(Date.now() + 120000).toISOString(),
  });
  await call(
    "/reminders/" + claim.id + "/validate",
    "POST",
    { claimToken: claim.claimToken },
    404,
  );
  await db.query(
    "UPDATE reminders SET due_at=now()-interval '1 second' WHERE task_id=$1",
    [t.id],
  );
  const replacement = (
    await call("/reminders/claim", "POST", { deviceId: winner })
  ).find((x: any) => x.taskId === t.id);
  assert.notEqual(replacement.id, claim.id);
  await call("/tasks/" + t.id + "/action", "POST", { action: "complete" });
  await call(
    "/reminders/" + replacement.id + "/validate",
    "POST",
    { claimToken: replacement.claimToken },
    404,
  );
});

test("v0.2 Push/browser competition and expired subscription cleanup", async () => {
  await login();
  const { claimReminders, pushTick } = await import(
    "../server/services/reminders.ts"
  );
  const { pool } = await import("../server/db.ts");
  try {
    assert.equal(
      (await pool.query("SELECT current_database() AS n")).rows[0].n,
      "study_test",
    );
    const subject = (await call("/state")).subjects[0];
    const t = await call(
      "/tasks",
      "POST",
      { title: "push competition", subject_id: subject.id },
      201,
    );
    await call("/tasks/" + t.id + "/reminder", "PUT", {
      due_at: new Date(Date.now() + 60000).toISOString(),
    });
    await db.query(
      "UPDATE reminders SET due_at=now()-interval '1 second' WHERE task_id=$1",
      [t.id],
    );
    const results = await Promise.all([
      claimReminders("browser:race"),
      claimReminders("push:race"),
    ]);
    assert.equal(results.flat().filter((r) => r.task_id === t.id).length, 1);
    const owned = results.flat().find((r) => r.task_id === t.id)!;
    await db.query(
      "UPDATE reminders SET claimed_at=now()-interval '1 minute' WHERE id=$1",
      [owned.id],
    );
    assert.ok(
      (await claimReminders(owned.recipient, false)).some(
        (r) => r.id === owned.id,
      ),
    );
    await call("/tasks/" + t.id + "/action", "POST", { action: "cancel" });
    const t2 = await call(
      "/tasks",
      "POST",
      { title: "expired push", subject_id: subject.id },
      201,
    );
    await call("/tasks/" + t2.id + "/reminder", "PUT", {
      due_at: new Date(Date.now() + 60000).toISOString(),
    });
    await db.query(
      "UPDATE reminders SET due_at=now()-interval '1 second' WHERE task_id=$1",
      [t2.id],
    );
    assert.ok(
      !(await claimReminders("browser:excluded", false)).some(
        (r) => r.task_id === t2.id,
      ),
    );
    await db.query(
      "INSERT INTO push_subscriptions(endpoint,subscription) VALUES('https://fcm.googleapis.com/test-expired','{}')",
    );
    let attempts = 0;
    await pushTick((async () => {
      attempts++;
      throw Object.assign(new Error("gone"), { statusCode: 410 });
    }) as any);
    assert.ok(attempts > 0);
    assert.equal(
      (
        await db.query(
          "SELECT 1 FROM push_subscriptions WHERE endpoint='https://fcm.googleapis.com/test-expired'",
        )
      ).rowCount,
      0,
    );
    const r = (
      await db.query("SELECT * FROM reminders WHERE task_id=$1", [t2.id])
    ).rows[0];
    assert.equal(r.status, "error");
    assert.equal(r.recipient, null);
    assert.equal(r.delivered_at, null);
  } finally {
    await pool.end();
  }
});

test("v0.2 compact timer aggregates match persisted effective minutes", async () => {
  await login();
  const subject = (await call("/state")).subjects[0];
  const t = await call(
    "/tasks",
    "POST",
    { title: "compact totals", subject_id: subject.id, estimated: 60 },
    201,
  );
  await call("/tasks/" + t.id + "/action", "POST", { action: "start" });
  await db.query(
    "UPDATE intervals SET start_at=$2 WHERE session_id IN (SELECT id FROM sessions WHERE task_id=$1) AND end_at IS NULL",
    [t.id, new Date(Date.now() - 35 * 60000)],
  );
  await call("/tasks/" + t.id + "/action", "POST", { action: "pause" });
  const wire = await fetch(base + "/api/state", {
    headers: { Cookie: cookie },
  }).then((r) => r.json());
  const actual = taskActual(wire, t.id, Date.parse(wire.now));
  assert.ok(actual >= 35 && actual < 35.1);
  assert.equal(wire.intervals.length, 0);
  assert.ok(
    wire.sessions.find((x: any) => x.task_id === t.id).elapsed_closed >= 2100,
  );
  await call("/tasks/" + t.id + "/action", "POST", { action: "stop" });
});

test("partial task edits preserve existing topic, estimate and English bucket", async () => {
  await login();
  const s = await call("/state");
  const subject = s.subjects.find((x: any) => x.name === "English");
  const topic = s.topics.find((x: any) => x.subject_id === subject.id);
  const t = await call(
    "/tasks",
    "POST",
    {
      title: "English partial patch",
      subject_id: subject.id,
      topic_id: topic.id,
      estimated: 90,
      bucket: "ENGLISH",
      note: "retain this",
      is_review: false,
    },
    201,
  );
  await call("/tasks/" + t.id + "/action", "POST", { action: "start" });
  await call("/tasks/" + t.id + "/action", "POST", { action: "pause" });
  await call("/tasks/" + t.id, "PATCH", { remaining: 40 });
  const after = (await db.query("SELECT * FROM tasks WHERE id=$1", [t.id]))
    .rows[0];
  assert.equal(after.remaining, 40);
  assert.equal(after.estimated, 90);
  assert.equal(after.topic_id, topic.id);
  assert.equal(after.bucket, "ENGLISH");
  assert.equal(after.note, "retain this");
  assert.equal(after.is_review, false);
  await call("/tasks/" + t.id + "/action", "POST", { action: "stop" });
});

test("v0.3 title-only capture can start unclassified and fill classification/estimate later", async () => {
  await login();
  const t = await call("/tasks", "POST", { title: "v03 quick capture" }, 201);
  assert.equal(t.subject_id, null);
  assert.equal(t.estimated, null);
  assert.equal(t.remaining, 0);
  const plan = (await db.query("SELECT * FROM plans WHERE task_id=$1", [t.id]))
    .rows[0];
  assert.equal(plan.level, "UNSCHEDULED");
  assert.equal(plan.remind_at_start, false);
  await call("/tasks", "POST", { title: "  " }, 400);
  await call(`/tasks/${t.id}/action`, "POST", { action: "start" });
  await db.query(
    "UPDATE intervals SET start_at=now()-interval '5 minutes' WHERE session_id IN (SELECT id FROM sessions WHERE task_id=$1) AND end_at IS NULL",
    [t.id],
  );
  await call(`/tasks/${t.id}/action`, "POST", { action: "stop" });
  assert.equal(
    (
      await db.query(
        "SELECT * FROM reviews WHERE session_id IN (SELECT id FROM sessions WHERE task_id=$1)",
        [t.id],
      )
    ).rowCount,
    0,
  );
  const s = await call("/state"),
    subject = s.subjects.find((x: any) => x.name === "English"),
    topic = s.topics.find((x: any) => x.subject_id === subject.id);
  await call(`/tasks/${t.id}`, "PATCH", {
    subject_id: subject.id,
    topic_id: topic.id,
    estimated: 30,
    bucket: "ENGLISH",
  });
  const saved = (await db.query("SELECT * FROM tasks WHERE id=$1", [t.id]))
    .rows[0];
  assert.equal(saved.subject_id, subject.id);
  assert.equal(saved.topic_id, topic.id);
  assert.equal(saved.estimated, 30);
  assert.ok(saved.remaining > 24.9 && saved.remaining < 25.1);
  await call(`/tasks/${t.id}/action`, "POST", { action: "start" });
  await call(`/tasks/${t.id}/action`, "POST", { action: "complete" });
  assert.equal(
    (
      await db.query(
        "SELECT * FROM reviews WHERE session_id IN (SELECT id FROM sessions WHERE task_id=$1)",
        [t.id],
      )
    ).rowCount,
    1,
  );
  const live = await call(
    "/tasks",
    "POST",
    { title: "v03 fill estimate while running" },
    201,
  );
  await call(`/tasks/${live.id}/action`, "POST", { action: "start" });
  await db.query(
    "UPDATE intervals SET start_at=now()-interval '35 minutes' WHERE session_id IN (SELECT id FROM sessions WHERE task_id=$1) AND end_at IS NULL",
    [live.id],
  );
  await call(`/tasks/${live.id}`, "PATCH", { estimated: 60 });
  const wire = await fetch(base + "/api/state", {
    headers: { Cookie: cookie },
  }).then((r) => r.json());
  const balance = wire.tasks.find((x: any) => x.id === live.id).remaining;
  assert.ok(balance > 24.9 && balance < 25.1);
  assert.ok(taskActual(wire, live.id, Date.parse(wire.now)) >= 34.9);
  await call(`/tasks/${live.id}/action`, "POST", { action: "pause" });
  await call(`/tasks/${live.id}/action`, "POST", { action: "stop" });
});

test("v0.3 fixed reminders track plans atomically, opt out, invalidate claims and preserve manual reminders", async () => {
  await login();
  const t = await call("/tasks", "POST", { title: "v03 fixed reminder" }, 201);
  const url = `/tasks/${t.id}/plan`;
  const fixed = { level: "FIXED", on_date: "2030-10-01", fixed_time: "20:00" };
  const reminder = async () =>
    (await db.query("SELECT * FROM reminders WHERE task_id=$1", [t.id]))
      .rows[0];
  const plans = async () =>
    (
      await db.query(
        "SELECT * FROM task_events WHERE task_id=$1 AND kind='PLAN_CHANGED'",
        [t.id],
      )
    ).rows;
  await call(url, "PUT", fixed);
  const first = await reminder();
  assert.equal(first.source, "fixed");
  assert.equal(first.due_at.toISOString(), "2030-10-01T12:00:00.000Z");
  await call(url, "PUT", fixed);
  assert.equal((await reminder()).id, first.id);
  assert.equal((await plans()).length, 1);
  // A claimed stale reminder must be rejected after a plan change.
  const token = crypto.randomUUID();
  await db.query(
    "UPDATE reminders SET claim_token=$2,status='sending',claimed_at=now() WHERE id=$1",
    [first.id, token],
  );
  await call(url, "PUT", { ...fixed, fixed_time: "20:30" });
  assert.equal(
    (await reminder()).due_at.toISOString(),
    "2030-10-01T12:30:00.000Z",
  );
  await call(
    `/reminders/${first.id}/validate`,
    "POST",
    { claimToken: token },
    404,
  );
  await call(url, "PUT", {
    ...fixed,
    fixed_time: "20:30",
    remind_at_start: false,
  });
  assert.equal(await reminder(), undefined);
  assert.equal((await plans()).length, 2);
  await call(url, "PUT", { ...fixed, fixed_time: "21:00" });
  assert.equal(await reminder(), undefined);
  await call(url, "PUT", { ...fixed, remind_at_start: true });
  assert.ok(await reminder());
  await call(url, "PUT", { level: "WEEK", on_date: "2030-10-01" });
  assert.equal(await reminder(), undefined);
  await call(`/tasks/${t.id}/reminder`, "PUT", {
    due_at: "2030-10-01T13:00:00Z",
  });
  const manual = await reminder();
  assert.equal(manual.source, "manual");
  await call(url, "PUT", { level: "DAY", on_date: "2030-10-02" });
  assert.equal((await reminder()).id, manual.id);
  await call(url, "PUT", fixed);
  await call(`/tasks/${t.id}/reminder`, "PUT", {
    due_at: new Date(Date.now() + 30 * 60000).toISOString(),
  });
  assert.equal((await reminder()).source, "manual");
  assert.equal(
    (
      await db.query("SELECT remind_at_start FROM plans WHERE task_id=$1", [
        t.id,
      ])
    ).rows[0].remind_at_start,
    false,
  );
  // Start on another day converts FIXED to DAY and removes only linked reminders.
  await call(url, "PUT", { ...fixed, remind_at_start: true });
  await call(`/tasks/${t.id}/action`, "POST", { action: "start" });
  assert.equal(await reminder(), undefined);
  await call(url, "PUT", { level: "WEEK", on_date: "2030-10-08" });
  const current = (
    await db.query(
      "SELECT * FROM sessions WHERE task_id=$1 AND state='RUNNING'",
      [t.id],
    )
  ).rows;
  assert.equal(current.length, 1);
  const before = (await plans()).length;
  await call(url, "PUT", { level: "WEEK", on_date: "2030-10-08" });
  assert.equal((await plans()).length, before);
  await call(`/tasks/${t.id}/action`, "POST", { action: "complete" });
});

test("v0.3 follow-up and do-again create independent tasks without copying history", async () => {
  await login();
  const s = await call("/state");
  const subject = s.subjects.find((x: any) => x.name === "Chinese"),
    topic = s.topics.find((x: any) => x.subject_id === subject.id);
  const t = await call(
    "/tasks",
    "POST",
    {
      title: "v03 original",
      subject_id: subject.id,
      topic_id: topic.id,
      estimated: 45,
      is_review: false,
      note: "original only",
      subtasks: ["done"],
    },
    201,
  );
  await call(`/tasks/${t.id}/copy`, "POST", { mode: "again" }, 400);
  await call(`/tasks/${t.id}/action`, "POST", { action: "start" });
  const sub = (
    await db.query("SELECT id FROM subtasks WHERE task_id=$1", [t.id])
  ).rows[0];
  await call(`/subtasks/${sub.id}`, "PATCH", { completed: true });
  await call(`/tasks/${t.id}/reminder`, "PUT", {
    due_at: "2030-10-01T13:00:00Z",
  });
  await call(`/tasks/${t.id}/action`, "POST", { action: "complete" });
  const original = async () => ({
    task: (await db.query("SELECT * FROM tasks WHERE id=$1", [t.id])).rows,
    events: (
      await db.query("SELECT * FROM task_events WHERE task_id=$1 ORDER BY id", [
        t.id,
      ])
    ).rows,
    sessions: (
      await db.query("SELECT * FROM sessions WHERE task_id=$1 ORDER BY id", [
        t.id,
      ])
    ).rows,
  });
  const before = await original();
  await call(`/tasks/${t.id}/copy`, "POST", { mode: "follow-up" }, 400);
  const follow = await call(
    `/tasks/${t.id}/copy`,
    "POST",
    { mode: "follow-up", title: "Redo Q4, Q7" },
    201,
  );
  const again = await call(
    `/tasks/${t.id}/copy`,
    "POST",
    { mode: "again" },
    201,
  );
  assert.equal(follow.title, "Redo Q4, Q7");
  assert.equal(follow.estimated, null);
  assert.equal(again.title, t.title);
  assert.equal(again.estimated, 45);
  assert.equal(again.remaining, 45);
  assert.equal(again.is_review, false);
  for (const copy of [follow, again]) {
    assert.notEqual(copy.id, t.id);
    assert.equal(copy.status, "TODO");
    assert.equal(copy.subject_id, subject.id);
    assert.equal(copy.topic_id, topic.id);
    assert.equal(copy.completed_at, null);
    assert.equal(copy.note, "");
    assert.equal(
      (await db.query("SELECT level FROM plans WHERE task_id=$1", [copy.id]))
        .rows[0].level,
      "UNSCHEDULED",
    );
    for (const table of ["sessions", "reminders", "subtasks"])
      assert.equal(
        (await db.query(`SELECT * FROM ${table} WHERE task_id=$1`, [copy.id]))
          .rowCount,
        0,
      );
    assert.deepEqual(
      (
        await db.query("SELECT kind FROM task_events WHERE task_id=$1", [
          copy.id,
        ])
      ).rows,
      [{ kind: "CREATED" }],
    );
  }
  assert.deepEqual(await original(), before);
});

test("v0.3 archive search covers older pages and literal symbols for completed and cancelled tasks", async () => {
  await login();
  const ids: string[] = [];
  for (const status of ["COMPLETED", "CANCELLED"]) {
    const t = await call(
      "/tasks",
      "POST",
      { title: `v03 NeedLe%_ ${status}` },
      201,
    );
    ids.push(t.id);
    await call(`/tasks/${t.id}/action`, "POST", {
      action: status === "COMPLETED" ? "complete" : "cancel",
    });
  }
  // Newer filler forces each target out of page one, without editing immutable event rows.
  await db.query(
    "INSERT INTO tasks(title,subject_id,estimated,remaining,bucket,status,completed_at,cancelled_at) SELECT 'v03 filler '||n,NULL,NULL,0,'FLEXIBLE',status,CASE WHEN status='COMPLETED' THEN now() END,CASE WHEN status='CANCELLED' THEN now() END FROM generate_series(1,35) n CROSS JOIN (VALUES ('COMPLETED'),('CANCELLED')) x(status)",
  );
  for (const [i, status] of ["COMPLETED", "CANCELLED"].entries()) {
    const first = await call(`/history/archive?status=${status}`);
    assert.ok(!first.items.some((x: any) => x.id === ids[i]));
    assert.equal(first.hasMore, true);
    const found = await call(
      `/history/archive?status=${status}&search=${encodeURIComponent("needle%_")}`,
    );
    assert.deepEqual(
      found.items.map((x: any) => x.id),
      [ids[i]],
    );
    assert.equal(found.hasMore, false);
    const empty = await call(
      `/history/archive?status=${status}&search=${encodeURIComponent("' OR 1=1 --")}`,
    );
    assert.equal(empty.items.length, 0);
  }
});

test("capture saves the selected day atomically and rejects invalid dates", async () => {
  await login();
  for (const on_date of [undefined, null, isoDay(), "2026-09-09", "2026-10-03"]) {
    const t = await call("/tasks", "POST", { title: "Capture date verification", on_date }, 201);
    const p = (await db.query("SELECT * FROM plans WHERE task_id=$1", [t.id])).rows[0];
    assert.equal(p.level, on_date ? "DAY" : "UNSCHEDULED");
    assert.equal(p.on_date, on_date ?? null);
    assert.equal(p.fixed_time, null);
    assert.equal(t.estimated, null);
  }
  const before = Number((await db.query("SELECT count(*) n FROM tasks")).rows[0].n);
  for (const on_date of ["", "2026-02-30", "not-a-date"]) {
    await call("/tasks", "POST", { title: "Invalid capture", on_date }, 400);
  }
  await call("/tasks", "POST", { title: "Rolled back capture", on_date: isoDay(), subject_id: "00000000-0000-4000-8000-000000000000" }, 400);
  assert.equal(Number((await db.query("SELECT count(*) n FROM tasks")).rows[0].n), before);
});

test("capture can create a fixed plan and its linked reminder atomically", async () => {
  await login();
  const t = await call(
    "/tasks",
    "POST",
    { title: "Fixed capture reminder", on_date: "2030-10-01", fixed_time: "20:00" },
    201,
  );
  const plan = (await db.query("SELECT * FROM plans WHERE task_id=$1", [t.id])).rows[0];
  const reminder = (await db.query("SELECT * FROM reminders WHERE task_id=$1", [t.id])).rows[0];
  assert.equal(plan.level, "FIXED");
  assert.equal(plan.fixed_time, "20:00");
  assert.equal(plan.remind_at_start, true);
  assert.equal(reminder.source, "fixed");
  assert.equal(new Date(reminder.due_at).toISOString(), "2030-10-01T12:00:00.000Z");
  const silent = await call(
    "/tasks",
    "POST",
    { title: "Fixed capture without reminder", on_date: "2030-10-01", fixed_time: "10:00", remind_at_start: false },
    201,
  );
  assert.equal(
    (await db.query("SELECT count(*) n FROM reminders WHERE task_id=$1", [silent.id])).rows[0].n,
    "0",
  );
});


test("locale can switch between Traditional Chinese and English", async () => {
  await login();
  let state = await call("/state");
  assert.ok(["zh-Hant", "en"].includes(state.locale));
  await call("/locale", "PUT", { locale: "en" });
  state = await call("/state");
  assert.equal(state.locale, "en");
  await call("/locale", "PUT", { locale: "zh-Hant" });
  state = await call("/state");
  assert.equal(state.locale, "zh-Hant");
  await call("/locale", "PUT", { locale: "fr" }, 400);
});

test("password can be changed and other sessions are revoked", async () => {
  await login();
  const oldPassword = process.env.TEST_PASSWORD!;
  const nextPassword = "changed-password-v03-test";
  await call("/auth/password", "POST", {
    current_password: oldPassword,
    new_password: nextPassword,
  });
  // Current cookie remains valid.
  await call("/state");
  // Old password no longer works for new login.
  const bad = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: oldPassword }),
  });
  assert.equal(bad.status, 401);
  // New password works.
  const good = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: nextPassword }),
  });
  assert.equal(good.status, 200);
  const newCookie = good.headers.get("set-cookie")!.split(";")[0];
  // Restore original test password for later tests.
  const restore = await fetch(base + "/api/auth/password", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: newCookie },
    body: JSON.stringify({
      current_password: nextPassword,
      new_password: oldPassword,
    }),
  });
  assert.equal(restore.status, 200);
  cookie = "";
  await login();
});
