import { Check, ChevronDown, Pause, Play, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Level, Task } from "../../shared/domain";
import {
  addDays,
  fmtMin,
  taskActual,
  taskRemaining,
} from "../../shared/domain";

import { api } from "../lib/api";
import { useUI } from "../lib/context";
import { t as i18n } from "../lib/i18n";
import { localDateTime } from "../lib/time";
import { Timeline } from "./History";
import { QuickMove, NextTask } from "./Workflow";
export function Detail({ t }: { t: Task }) {
  const {
    s,
    now,
    active,
    activeTask,
    busy,
    day,
    eng,
    flex,
    open,
    run,
    planTask,
    sorted,
    setSelected,
    setCapture,
    setNotice,
  } = useUI();
  const dict = i18n(s!.locale);
  const plan = s!.plans.find((p) => p.task_id === t.id)!;
  const rem = s!.reminders.find((x) => x.task_id === t.id);
  const [level, setLevel] = useState<Level>(plan.level),
    [date, setDate] = useState(plan.on_date ?? day),
    [fixed, setFixed] = useState(plan.fixed_time ?? "20:00"),
    [remaining, setRemaining] = useState(
      String(Math.round(taskRemaining(s!, t, now) * 10) / 10),
    ),
    [sub, setSub] = useState(""),
    [reminder, setReminder] = useState(
      rem ? localDateTime(new Date(rem.due_at)) : "",
    ),
    [title, setTitle] = useState(t.title),
    [note, setNote] = useState(t.note),
    [subject, setSubject] = useState(t.subject_id ?? ""),
    [topic, setTopic] = useState(t.topic_id ?? ""),
    [estimate, setEstimate] = useState(
      t.estimated === null ? "" : String(t.estimated),
    ),
    [linked, setLinked] = useState(
      plan.level === "FIXED" ? !!plan.remind_at_start : true,
    );
  useEffect(() => {
    setLevel(plan.level);
    setDate(plan.on_date ?? day);
    setFixed(plan.fixed_time ?? "20:00");
    setLinked(plan.level === "FIXED" ? !!plan.remind_at_start : true);
  }, [plan.level, plan.on_date, plan.fixed_time, plan.remind_at_start]);
  useEffect(() => {
    setReminder(rem ? localDateTime(new Date(rem.due_at)) : "");
  }, [rem?.id, rem?.due_at]);
  useEffect(() => {
    setRemaining(String(Math.round(taskRemaining(s, t, now) * 10) / 10));
  }, [t.remaining, t.estimated]);
  const ended = ["COMPLETED", "CANCELLED"].includes(t.status);
  const subs = s!.subtasks.filter((x) => x.task_id === t.id);
  return (
    <section className="editor" aria-label="任務詳情">
      <div className="section-heading">
        <div>
          <p className="muted">
            {s!.subjects.find((x) => x.id === t.subject_id)?.name ?? "未分類"} ·{" "}
            {dict.status[t.status]}
          </p>
          <h2>{t.title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="關閉任務詳情"
          onClick={() => setSelected(null)}
        >
          <X size={20} />
        </button>
      </div>
      {!ended && (
        <>
          <div className="session-buttons">
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                run(() =>
                  api("/tasks/" + t.id + "/action", "POST", {
                    action:
                      activeTask?.id === t.id
                        ? active?.state === "RUNNING"
                          ? "pause"
                          : "resume"
                        : "start",
                  }),
                )
              }
            >
              {activeTask?.id === t.id && active?.state === "RUNNING" ? (
                <Pause size={16} />
              ) : (
                <Play size={16} />
              )}{" "}
              {activeTask?.id === t.id
                ? active?.state === "RUNNING"
                  ? "暫停"
                  : "恢復"
                : t.status === "IN_PROGRESS"
                  ? "繼續學習"
                  : "開始學習"}
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run(() =>
                  api("/tasks/" + t.id + "/action", "POST", { action: "stop" }),
                )
              }
            >
              <Square size={14} /> 暫時停止
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run(() =>
                  api("/tasks/" + t.id + "/action", "POST", {
                    action: "complete",
                  }),
                )
              }
            >
              <Check size={16} /> 完成任務
            </button>
          </div>
          <p className="hint">
            暫停不計時；暫時停止會保存本次學習，下次可繼續。
          </p>
          <div className="detail-quick-actions">
            <button
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    api(`/tasks/${t.id}/reminder`, "PUT", {
                      due_at: new Date(now + 30 * 60000).toISOString(),
                    }),
                  () => setNotice("已設定 30 分鐘後提醒；原指定時間保持不變。"),
                )
              }
            >
              延後 30 分鐘
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    api(`/tasks/${t.id}/plan`, "PUT", {
                      level: plan.level === "FIXED" ? "FIXED" : "DAY",
                      on_date: addDays(day, 1),
                      fixed_time: plan.fixed_time,
                      remind_at_start: plan.remind_at_start,
                    }),
                  () => setNotice("已移到明天。"),
                )
              }
            >
              移到明天
            </button>
            <QuickMove t={t} />
          </div>
        </>
      )}
      {t.status === "COMPLETED" && <NextTask t={t} />}
      <div className="detail-stats">
        <span>
          原先預估{" "}
          <strong>
            {t.estimated === null ? "未估時" : fmtMin(t.estimated) + " 分鐘"}
          </strong>
        </span>
        <span>
          累積實際 <strong>{fmtMin(taskActual(s!, t.id, now))} 分鐘</strong>
        </span>
        <span>
          {ended ? "與預估差額" : "尚需"}{" "}
          <strong>
            {t.estimated === null
              ? "未估時"
              : ended
                ? `${fmtMin(Math.abs(t.estimated - taskActual(s!, t.id, now)))} 分鐘${taskActual(s!, t.id, now) <= t.estimated ? "節省" : "超時"}`
                : fmtMin(taskRemaining(s!, t, now)) + " 分鐘"}
          </strong>
        </span>
      </div>
      {subs.length > 0 && (
        <div className="subtask-list">
          {subs.map((x) => (
            <label className="check-label" key={x.id}>
              <input
                type="checkbox"
                checked={x.completed}
                disabled={ended || busy}
                onChange={(e) =>
                  run(() =>
                    api("/subtasks/" + x.id, "PATCH", {
                      completed: e.target.checked,
                    }),
                  )
                }
              />
              <span className={x.completed ? "done" : ""}>{x.title}</span>
            </label>
          ))}
        </div>
      )}
      {!ended && (
        <>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () =>
                  api("/tasks/" + t.id + "/subtasks", "POST", { title: sub }),
                () => setSub(""),
              );
            }}
          >
            <input
              aria-label="新增子項"
              placeholder="加入一個子項（可選）"
              value={sub}
              onChange={(e) => setSub(e.target.value)}
            />
            <button disabled={busy || !sub.trim()}>加入</button>
          </form>
          {t.estimated !== null && (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() =>
                    api("/tasks/" + t.id, "PATCH", {
                      remaining: Number(remaining),
                    }),
                  );
                }}
              >
                <div className="inline-form">
                  <label>
                    剩餘估時（分鐘）
                    <input
                      type="number"
                      min="0"
                      max="1440"
                      step="0.1"
                      value={remaining}
                      onChange={(e) => setRemaining(e.target.value)}
                    />
                  </label>
                  <button disabled={busy}>更新估時</button>
                </div>
              </form>
            </>
          )}
          <details open>
            <summary>
              安排與提醒 <ChevronDown size={14} />
            </summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() =>
                  api("/tasks/" + t.id + "/plan", "PUT", {
                    level,
                    on_date: level === "UNSCHEDULED" ? null : date,
                    fixed_time: level === "FIXED" ? fixed : null,
                    remind_at_start: level === "FIXED" && linked,
                  }),
                );
              }}
            >
              <div className="form-row">
                <label>
                  安排層級
                  <select
                    value={level}
                    onChange={(e) => {
                      setLevel(e.target.value as Level);
                      if (e.target.value === "FIXED" && plan.level !== "FIXED")
                        setLinked(true);
                    }}
                  >
                    {(
                      [
                        "UNSCHEDULED",
                        "MONTH",
                        "WEEK",
                        "DAY",
                        "FIXED",
                      ] as Level[]
                    ).map((x) => (
                      <option value={x} key={x}>
                        {dict.level[x as Level]}
                      </option>
                    ))}
                  </select>
                </label>
                {level !== "UNSCHEDULED" && (
                  <label>
                    {level === "MONTH"
                      ? "選擇月份中的任一天"
                      : level === "WEEK"
                        ? "選擇該週中的任一天"
                        : "日期"}
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </label>
                )}
                {level === "FIXED" && (
                  <label>
                    時間
                    <input
                      type="time"
                      required
                      value={fixed}
                      onChange={(e) => setFixed(e.target.value)}
                    />
                  </label>
                )}
              </div>
              {level === "FIXED" && (
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={linked}
                    onChange={(e) => setLinked(e.target.checked)}
                  />
                  到這個時間提醒我
                </label>
              )}
              {level === "FIXED" && linked && (
                <p className="hint">
                  提醒與指定時間同步；如時間已過，儲存後會盡快提醒。
                </p>
              )}
              <div className="form-footer">
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    run(
                      () => planTask(t, "DAY"),
                      () => {
                        setLevel("DAY");
                        setDate(day);
                      },
                    )
                  }
                >
                  選入今天
                </button>
                <button disabled={busy}>儲存安排</button>
              </div>
            </form>
            {!(plan.level === "FIXED" && plan.remind_at_start) && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() =>
                    api("/tasks/" + t.id + "/reminder", "PUT", {
                      due_at: reminder
                        ? new Date(reminder + ":00+08:00").toISOString()
                        : null,
                    }),
                  );
                }}
              >
                <label>
                  提醒時間（香港時間，選填）
                  <input
                    type="datetime-local"
                    value={reminder}
                    onChange={(e) => setReminder(e.target.value)}
                  />
                </label>
                <div className="form-footer">
                  <span className="hint">
                    {rem?.delivered_at
                      ? "瀏覽器已確認送達"
                      : rem
                        ? rem.status === "error"
                          ? "送達失敗，等待重試"
                          : rem.status === "sending"
                            ? rem.accepted_at
                              ? "推送服務已接受，等待瀏覽器確認"
                              : "正在傳送"
                            : "等待提醒時間"
                        : "只有設定後才通知"}
                    {rem?.error && " · " + rem.error}
                  </span>
                  <button disabled={busy}>儲存提醒</button>
                </div>
              </form>
            )}
            {plan.level === "FIXED" && plan.remind_at_start && (
              <p className="hint">
                到點提醒：{plan.on_date} {plan.fixed_time}（香港時間）
                {rem?.delivered_at ? " · 已送達" : ""}
              </p>
            )}
          </details>
          <details>
            <summary>
              編輯內容 <ChevronDown size={14} />
            </summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() =>
                  api("/tasks/" + t.id, "PATCH", {
                    title,
                    note,
                    subject_id: subject || null,
                    topic_id: topic || null,
                    estimated: estimate ? Number(estimate) : null,
                    bucket:
                      s.subjects.find((x) => x.id === subject)?.name ===
                      "English"
                        ? "ENGLISH"
                        : "FLEXIBLE",
                  }),
                );
              }}
            >
              <label>
                名稱
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <div className="form-row">
                <label>
                  科目
                  <select
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value);
                      setTopic("");
                    }}
                  >
                    <option value="">未分類</option>
                    {s.subjects.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Topic
                  <select
                    disabled={!subject}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  >
                    <option value="">暫不分類</option>
                    {s.topics
                      .filter((x) => x.subject_id === subject)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  預估分鐘
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    placeholder="未估時"
                    value={estimate}
                    onChange={(e) => setEstimate(e.target.value)}
                  />
                </label>
              </div>
              {t.estimated === null && (
                <p className="hint">
                  首次補上預估時，剩餘時間會扣除已投入的實際時間。
                </p>
              )}
              <label>
                備註
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <button disabled={busy}>儲存內容</button>
            </form>
            <button
              className="danger text-button"
              onClick={() =>
                run(
                  () =>
                    api("/tasks/" + t.id + "/action", "POST", {
                      action: "cancel",
                    }),
                  () => setSelected(null),
                )
              }
            >
              取消此任務
            </button>
          </details>
        </>
      )}
      {ended && t.note && <p>{t.note}</p>}
      <Timeline task={t} />
    </section>
  );
}
