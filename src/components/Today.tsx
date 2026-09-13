import { ArrowRight, BookOpen, Clock, Leaf, Play, Plus } from "lucide-react";
import {
  finishEstimate,
  fmtMin,
  isoDay,
  taskRemaining,
} from "../../shared/domain";

import { api } from "../lib/api";
import { useUI } from "../lib/context";
import { List, TaskCard } from "./Tasks";
export function Ring() {
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
  const total = eng.total + flex.total;
  const segments = [
    { value: eng.total, label: "固定英文", color: "var(--primary)" },
    ...flex.planned
      .filter((t) => t.status !== "COMPLETED")
      .map((t) => ({
        value: taskRemaining(s!, t, now),
        label: t.title,
        color:
          "var(--" +
          (s!.subjects.find((x) => x.id === t.subject_id)?.color ?? "blue") +
          ")",
      })),
    { value: flex.actual, label: "自由學習已用", color: "var(--ink)" },
  ];
  let position = 0;
  return (
    <div
      className="ring"
      role="img"
      aria-label={`今日容量 ${total} 分鐘，英文 ${eng.total} 分鐘，自由 ${flex.total} 分鐘，超額 ${fmtMin(eng.over + flex.over)} 分鐘`}
    >
      <svg viewBox="0 0 240 240">
        <circle className="ring-track" cx="120" cy="120" r="96" />
        {segments.map((seg, i) => {
          const len = Math.max(
            0,
            Math.min(seg.value, Math.max(0, total - position)),
          );
          const start = position;
          position += seg.value;
          return (
            <circle
              key={i}
              cx="120"
              cy="120"
              r="96"
              fill="none"
              stroke={seg.color}
              strokeWidth="17"
              pathLength="100"
              strokeDasharray={`${Math.max(0, (len / Math.max(total, 1)) * 100 - 0.9)} ${100 - Math.max(0, (len / Math.max(total, 1)) * 100 - 0.9)}`}
              strokeDashoffset={(-start / Math.max(total, 1)) * 100}
              transform="rotate(-90 120 120)"
            >
              <title>
                {seg.label} {fmtMin(seg.value)} 分鐘
              </title>
            </circle>
          );
        })}
      </svg>
      <div className="ring-center">
        <span>今天的學習容量</span>
        <strong>
          {total}
          <small>分鐘</small>
        </strong>
        <span>
          {Math.floor(total / 60)} 小時{total % 60 ? ` ${total % 60} 分鐘` : ""}
          ，按你的步調
        </span>
      </div>
    </div>
  );
}

export function TodayPage({
  go,
  setFilter,
}: {
  go: (p: string) => void;
  setFilter: (s: string) => void;
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
  const finish = finishEstimate(s, day, now);
  const unscheduled = open.filter(
    (t) => s.plans.find((p) => p.task_id === t.id)?.level === "UNSCHEDULED",
  );
  return (
    <>
      {activeTask && (
        <section className="current-study" aria-label="目前進行的任務">
          <h2>目前學習</h2>
          <TaskCard t={activeTask} />
        </section>
      )}
      <div className="today-columns">
        <section>
          <div className="section-heading">
            <h2>
              今日學習{" "}
              <span className="count">
                {
                  [...eng.planned, ...flex.planned].filter(
                    (t) =>
                      t.id !== activeTask?.id &&
                      !["COMPLETED", "CANCELLED"].includes(t.status),
                  ).length
                }
              </span>
            </h2>
            <button
              className="text-button"
              onClick={() => {
                go("tasks");
                setFilter("open");
              }}
            >
              從任務池選擇 <ArrowRight size={15} />
            </button>
          </div>
          {eng.implicit > 0 && (
            <article className="routine-card">
              <div className="routine-symbol">
                <BookOpen size={22} />
              </div>
              <div>
                <strong>每日英文</strong>
                <p>尚餘預留 {fmtMin(eng.implicit)} 分鐘 · 自動套用</p>
              </div>
              <button
                className="small primary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const t = await api("/routine/start", "POST");
                    await api("/tasks/" + t.id + "/action", "POST", {
                      action: "start",
                    });
                    setSelected(t.id);
                  })
                }
              >
                <Play size={14} /> 開始
              </button>
            </article>
          )}
          <List
            tasks={[...eng.planned, ...flex.planned].filter(
              (t) =>
                t.id !== activeTask?.id &&
                !["COMPLETED", "CANCELLED"].includes(t.status),
            )}
          />
        </section>
        <aside className="today-aside">
          <div className="section-heading">
            <h3>還沒安排的事</h3>
            <span className="count">{unscheduled.length}</span>
          </div>
          {unscheduled.slice(0, 3).map((t) => (
            <div className="inbox-row" key={t.id}>
              <button onClick={() => setSelected(t.id)}>
                {t.title}
                <span>
                  {s.subjects.find((x) => x.id === t.subject_id)?.name ??
                    "未分類"}{" "}
                  ·{" "}
                  {t.estimated === null
                    ? "未估時"
                    : fmtMin(t.remaining) + " 分鐘"}
                </span>
              </button>
              <button
                className="icon-button"
                aria-label={"選入今天 " + t.title}
                disabled={busy}
                onClick={() => run(() => planTask(t, "DAY"))}
              >
                <Plus size={17} />
              </button>
            </div>
          ))}
          {!unscheduled.length && (
            <p className="muted">想到新的學習內容時，先記在任務池。</p>
          )}
          <button
            className="text-button"
            onClick={() => {
              go("tasks");
              setFilter("unscheduled");
            }}
          >
            查看未安排 <ArrowRight size={15} />
          </button>
          <div className="small-note">
            <Leaf size={18} />
            <p>
              未完成也沒關係。
              <br />
              停下來，進度會替你留著。
            </p>
          </div>
        </aside>
      </div>
      <details className="capacity-details">
        <summary>查看時間容量與完成推算</summary>
        <section className="today-overview">
          <Ring />
          <div className="capacity-info">
            <div className="capacity-title">
              <h2>今天排得下嗎？</h2>
              <span
                className={
                  "badge " + (eng.over + flex.over > 0 ? "warning" : "")
                }
              >
                {eng.over + flex.over > 0 ? "稍微排滿了" : "依自己的步調"}
              </span>
            </div>
            <div className="capacity-line">
              <span>
                <i className="legend green" /> 固定英文
              </span>
              <strong>
                {eng.total} <small>分鐘</small>
              </strong>
            </div>
            <div className="capacity-line">
              <span>
                <i className="legend blue" /> 自由安排
              </span>
              <strong>
                {flex.total} <small>分鐘</small>
              </strong>
            </div>
            <div className="capacity-breakdown">
              <div>
                <span>自由已安排／已用</span>
                <strong data-testid="used">
                  {fmtMin(flex.used)}
                  <small>分</small>
                </strong>
              </div>
              <div>
                <span>{flex.over ? "自由超出容量" : "自由尚可安排"}</span>
                <strong
                  className={flex.over ? "over" : "green-text"}
                  data-testid="remaining"
                >
                  {fmtMin(flex.over || flex.remaining)}
                  <small>分</small>
                </strong>
              </div>
            </div>
            <p className="finish">
              <Clock size={15} /> 理論完成{" "}
              {new Date(finish.at).toLocaleTimeString("zh-HK", {
                timeZone: "Asia/Hong_Kong",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
              {isoDay(finish.at) !== day ? "（翌日）" : ""}
              <span>從現在或設定開始時間推算</span>
            </p>
            {finish.collisions.length > 0 && (
              <p className="warning-text">
                指定時間有衝突：{finish.collisions.join("、")}
              </p>
            )}
            {[...eng.planned, ...flex.planned].some(
              (t) =>
                t.estimated === null &&
                !["COMPLETED", "CANCELLED"].includes(t.status),
            ) && (
              <p className="hint">
                有任務尚未估時，容量與完成推算未包含這些任務的剩餘工作。
              </p>
            )}
            {eng.over > 0 && (
              <p className="warning-text">英文超出 {fmtMin(eng.over)} 分鐘</p>
            )}
          </div>
        </section>
      </details>
    </>
  );
}
