import {
  ArrowRight,
  ChevronDown,
  Clock,
  Layers,
  Pause,
  Play,
  Plus,
  Star,
  X,
} from "lucide-react";
import { useState } from "react";
import type { Task } from "../../shared/domain";
import { addDays, fmtMin, taskActual, taskRemaining } from "../../shared/domain";
import { t as i18n } from "../lib/i18n";
import { ArchiveTasks } from "./History";
import { QuickMove, NextTask } from "./Workflow";

import { api } from "../lib/api";
import { useUI } from "../lib/context";
export function TaskCard({
  t,
  showAdd = false,
}: {
  t: Task;
  showAdd?: boolean;
}) {
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
    togglePriority,
    sorted,
    setSelected,
    setCapture,
    setNotice,
  } = useUI();
  const dict = i18n(s!.locale);
  const subject = s!.subjects.find((x) => x.id === t.subject_id) ?? {
    name: s!.locale === "en" ? "Uncategorized" : "未分類",
    color: "blue",
  };
  const subs = s!.subtasks.filter((x) => x.task_id === t.id);
  const plan = s!.plans.find((p) => p.task_id === t.id)!;
  const isActive = t.id === activeTask?.id;
  const ended = ["COMPLETED", "CANCELLED"].includes(t.status);
  return (
    <article
      className={"task-card " + (isActive ? "active-card" : "")}
      data-testid="task-card"
    >
      <div className="task-main">
        <span className={"subject-dot " + subject.color} />
        <div className="task-copy">
          <div className="task-meta">
            <span>{subject.name}</span>
            {t.topic_id && (
              <span>／{s!.topics.find((x) => x.id === t.topic_id)?.name}</span>
            )}
            <span className={"status " + t.status}>{dict.status[t.status]}</span>
          </div>
          <button
            className="task-title"
            onClick={() => {
              setSelected(t.id);
              setCapture(false);
            }}
          >
            {t.title}
          </button>
          <div className="task-summary">
            <span>
              <Clock size={13} />{" "}
              {ended
                ? "實際 " + fmtMin(taskActual(s!, t.id, now)) + " 分鐘"
                : t.estimated === null
                  ? "未估時"
                  : "尚需 " + fmtMin(taskRemaining(s!, t, now)) + " 分鐘"}
            </span>
            {subs.length > 0 && (
              <span>
                {subs.filter((x) => x.completed).length}/{subs.length} 子項
              </span>
            )}
            <span>
              {plan.level === "UNSCHEDULED"
                ? dict.level.UNSCHEDULED
                : plan.level === "FIXED"
                  ? plan.on_date
                  : plan.level === "MONTH"
                    ? (s!.locale === "en"
                        ? `${plan.on_date?.slice(0, 7)} month`
                        : plan.on_date?.slice(0, 7) + " 月內")
                    : plan.level === "WEEK"
                      ? (s!.locale === "en"
                          ? `${plan.on_date} week`
                          : plan.on_date + " 這一週")
                      : plan.on_date}
            </span>
          </div>
        </div>
      </div>
      {plan.level === "FIXED" && plan.fixed_time && (
        <div className="task-start-time">
          <span>{s!.locale === "en" ? "Starts at" : "開始時間"}</span>
          <time dateTime={`${plan.on_date}T${plan.fixed_time}`}>
            {plan.fixed_time.slice(0, 5)}
          </time>
        </div>
      )}
      <div className="task-actions">
        {plan.on_date === day && ["DAY", "FIXED"].includes(plan.level) && !ended && (
          <button
            className={"icon-button priority-button " + (t.priority_date === day ? "selected" : "")}
            aria-label={t.priority_date === day ? "取消今日優先" : "設為今日優先"}
            title={t.priority_date === day ? "取消今日優先" : "設為今日優先"}
            disabled={busy}
            onClick={() => run(() => togglePriority(t))}
          >
            <Star size={16} fill={t.priority_date === day ? "currentColor" : "none"} />
          </button>
        )}
        {!ended &&
          (isActive ? (
            <button
              className="small primary"
              disabled={busy}
              onClick={() =>
                run(() =>
                  api("/tasks/" + t.id + "/action", "POST", {
                    action: active!.state === "RUNNING" ? "pause" : "resume",
                  }),
                )
              }
            >
              {active?.state === "RUNNING" ? (
                <Pause size={14} />
              ) : (
                <Play size={14} />
              )}{" "}
              {active?.state === "RUNNING" ? "暫停" : "恢復"}
            </button>
          ) : (
            <button
              className="small primary"
              disabled={busy}
              onClick={() =>
                run(() =>
                  api("/tasks/" + t.id + "/action", "POST", {
                    action: "start",
                  }),
                )
              }
            >
              <Play size={14} /> {t.status === "IN_PROGRESS" ? "繼續" : "開始"}
            </button>
          ))}
        {!ended && <QuickMove t={t} />}
        {t.status === "COMPLETED" && <NextTask t={t} />}
      </div>
    </article>
  );
}
export const List = ({
  tasks,
  add = false,
}: {
  tasks: Task[];
  add?: boolean;
}) => {
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
  return tasks.length ? (
    <div className="task-list">
      {sorted(tasks).map((t) => (
        <TaskCard key={t.id} t={t} showAdd={add} />
      ))}
    </div>
  ) : (
    <div className="empty">
      <Layers size={26} />
      <h3>這裡還有留白</h3>
      <p>先記下想到的學習內容，準備好後再安排。</p>
      <button className="text-button" onClick={() => setCapture(true)}>
        新增第一個任務 <ArrowRight size={15} />
      </button>
    </div>
  );
};
export function Capture({ onSaved }: { onSaved: (onDate: string | null) => void }) {
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
  const [title, setTitle] = useState(""),
    [subject, setSubject] = useState(""),
    [duration, setDuration] = useState(""),
    [topic, setTopic] = useState(""),
    [notes, setNotes] = useState(""),
    [subs, setSubs] = useState(""),
    [review, setReview] = useState(true),
    [schedule, setSchedule] = useState("unscheduled"),
    [customDate, setCustomDate] = useState(day),
    [fixedTime, setFixedTime] = useState("20:00"),
    [remindAtStart, setRemindAtStart] = useState(true);
  const onDate = schedule === "today" ? day
    : schedule === "tomorrow" ? addDays(day, 1)
    : schedule === "custom" || schedule === "fixed" ? customDate : null;
  return (
    <section className="editor capture" aria-label="新增任務">
      <div className="section-heading">
        <h2>先記下來</h2>
        <button
          className="icon-button"
          aria-label="關閉新增任務"
          onClick={() => setCapture(false)}
        >
          <X size={19} />
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              api("/tasks", "POST", {
                title,
                on_date: onDate,
                fixed_time: schedule === "fixed" ? fixedTime : null,
                remind_at_start: schedule === "fixed" ? remindAtStart : undefined,
                subject_id: subject || null,
                topic_id: topic || null,
                estimated: duration ? Number(duration) : null,
                note: notes,
                is_review: review,
                bucket:
                  s!.subjects.find((x) => x.id === subject)?.name === "English"
                    ? "ENGLISH"
                    : "FLEXIBLE",
                subtasks: subs
                  .split("\n")
                  .map((x) => x.trim())
                  .filter(Boolean),
              }),
            () => onSaved(onDate),
          );
        }}
      >
        <label>
          要做什麼？
          <input
            autoFocus
            required
            maxLength={200}
            placeholder="例如：複習文言文第二課"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <fieldset className="capture-schedule" disabled={busy}>
          <legend>打算哪天做？</legend>
          <div className="capture-date-options">
            {[["unscheduled", "未安排"], ["today", "今天"], ["tomorrow", "明天"], ["custom", "自訂日期"], ["fixed", "指定時間"]].map(([value, label]) => (
              <label key={value} className="capture-date-option">
                <input type="radio" name="capture-date" value={value}
                  checked={schedule === value} onChange={() => setSchedule(value)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          {(schedule === "custom" || schedule === "fixed") && (
            <label className="capture-custom-date">
              選擇日期
              <input type="date" required value={customDate}
                onChange={(e) => setCustomDate(e.target.value)} />
            </label>
          )}
          {schedule === "fixed" && (
            <div className="fixed-capture-options">
              <label>
                指定時間
                <input
                  type="time"
                  required
                  value={fixedTime}
                  onChange={(e) => setFixedTime(e.target.value)}
                />
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={remindAtStart}
                  onChange={(e) => setRemindAtStart(e.target.checked)}
                />
                到這個時間提醒我
              </label>
            </div>
          )}
        </fieldset>
        <details>
          <summary>
            補充分類與估時（可稍後再填） <ChevronDown size={14} />
          </summary>
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
                {s!.subjects.map((x) => (
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
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </label>
          </div>

          <label>
            Topic
            <select
              disabled={!subject}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            >
              <option value="">暫不分類</option>
              {s!.topics
                .filter((x) => x.subject_id === subject)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            子項（一行一項）
            <textarea value={subs} onChange={(e) => setSubs(e.target.value)} />
          </label>
          <label>
            備註
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={review}
              onChange={(e) => setReview(e.target.checked)}
            />{" "}
            此任務是複習，學習後自動留下紀錄
          </label>
        </details>
        <div className="form-footer">
          <span aria-live="polite">{schedule === "fixed" ? `儲存後安排在 ${onDate} ${fixedTime}${remindAtStart ? "，並在到時提醒你。" : "。"}` : onDate ? `儲存後安排在 ${onDate}。` : schedule === "custom" ? "請選擇日期。" : "先存到未安排，稍後再決定時間。"}</span>
          <button className="primary" disabled={busy || !title.trim()}>
            儲存任務 <ArrowRight size={15} />
          </button>
        </div>
      </form>
    </section>
  );
}

export function TasksPage({
  filter,
  setFilter,
  search,
  tasks,
}: {
  filter: string;
  setFilter: (s: string) => void;
  search: string;
  tasks: Task[];
}) {
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

  return (
    <>
      <div className="task-toolbar">
        <div className="tabs task-filter-tabs" role="group" aria-label="任務篩選">
          {[
            ["open", "所有未完成"],
            ["unscheduled", "未安排"],
            ["week", "本週"],
            ["month", "本月"],
            ["progress", "進行中"],
            ["scheduled", "已安排"],
            ["completed", "已完成"],
            ["cancelled", "已取消"],
          ].map(([v, l]) => (
            <button
              key={v}
              className={filter === v ? "selected" : ""}
              aria-pressed={filter === v}
              onClick={(event) => {
                setFilter(v);
                event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      {["completed", "cancelled"].includes(filter) ? (
        <ArchiveTasks status={filter.toUpperCase()} search={search} />
      ) : (
        <List tasks={tasks} add />
      )}
    </>
  );
}
