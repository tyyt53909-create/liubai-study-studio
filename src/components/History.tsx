import { useEffect, useState } from "react";
import type { Plan, Task } from "../../shared/domain";
import { api } from "../lib/api";
import { useUI } from "../lib/context";
import { t as i18n } from "../lib/i18n";
import { humanDate } from "../lib/time";
import { NextTask } from "./Workflow";
import { ManualReview, ReviewRows } from "./Reviews";
const kinds: Record<string, string> = {
  CREATED: "建立任務",
  PLAN_CHANGED: "調整安排",
  SESSION_STARTED: "開始學習",
  SESSION_PAUSED: "暫停",
  SESSION_RESUMED: "恢復學習",
  SESSION_STOPPED: "停止學習",
  COMPLETED: "完成任務",
  CANCELLED: "取消任務",
};
type TaskEvent = {
  id: string;
  task_id: string;
  kind: string;
  occurred_at: string;
  title: string;
  subject_id: string;
  before_plan: Plan | null;
  after_plan: Plan | null;
};
const planText = (p: Plan, locale: "zh-Hant" | "en") => {
  const level = i18n(locale).level[p.level];
  return `${level}${p.on_date ? " · " + p.on_date : ""}${p.fixed_time ? " " + p.fixed_time : ""}`;
};
function EventRow({ event, open }: { event: TaskEvent; open?: () => void }) {
  const { s } = useUI();
  const locale = s.locale;
  return (
    <article className="history-row">
      <div>
        {open ? (
          <button className="task-title" onClick={open}>
            {event.title}
          </button>
        ) : (
          <strong>{kinds[event.kind] || event.kind}</strong>
        )}
        <p>
          {open && (kinds[event.kind] || event.kind) + " · "}
          <time>{humanDate(event.occurred_at, locale)}</time>
        </p>
        {event.before_plan && event.after_plan && (
          <p className="muted">
            {planText(event.before_plan, locale)} →{" "}
            {planText(event.after_plan, locale)}
          </p>
        )}
      </div>
    </article>
  );
}
export function Timeline({ task }: { task: Task }) {
  const [expanded, setExpanded] = useState(false),
    [items, setItems] = useState<TaskEvent[]>([]),
    [offset, setOffset] = useState(0),
    [more, setMore] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!expanded) return;
    let live = true;
    api(`/history/tasks?task=${task.id}&offset=${offset}`)
      .then((r) => {
        if (live) {
          setItems(r.items);
          setMore(r.hasMore);
          setError("");
        }
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [expanded, task.id, task.updated_at, offset]);
  return (
    <details
      className="timeline"
      onToggle={(e) => setExpanded(e.currentTarget.open)}
    >
      <summary>任務時間線</summary>
      {["COMPLETED", "CANCELLED"].includes(task.status) &&
        !task.completed_at &&
        !task.cancelled_at && <p>v0.2 前，精確時間未知</p>}
      {error && <p role="alert">{error}</p>}
      {items.map((e) => (
        <EventRow key={e.id} event={e} />
      ))}
      {!items.length && !error && (
        <p className="muted">尚無 v0.2 事件；舊資料保留原樣。</p>
      )}
      <Pager offset={offset} more={more} setOffset={setOffset} />
    </details>
  );
}
function Pager({
  offset,
  more,
  setOffset,
}: {
  offset: number;
  more: boolean;
  setOffset: (n: number) => void;
}) {
  return (
    <div className="history-pagination">
      {offset > 0 && (
        <button onClick={() => setOffset(Math.max(0, offset - 30))}>
          上一頁
        </button>
      )}
      {more && <button onClick={() => setOffset(offset + 30)}>下一頁</button>}
    </div>
  );
}
export function ArchiveTasks({
  status,
  search = "",
  legacy = false,
  subject = "",
}: {
  status?: string;
  search?: string;
  legacy?: boolean;
  subject?: string;
}) {
  const { s, setSelected } = useUI();
  const [data, setData] = useState<{ items: Task[]; hasMore: boolean }>({
      items: [],
      hasMore: false,
    }),
    [offset, setOffset] = useState(0),
    [error, setError] = useState("");
  useEffect(() => {
    setOffset(0);
  }, [status, subject, legacy, search]);
  useEffect(() => {
    let live = true;
    api(
      `/history/archive?search=${encodeURIComponent(search)}&offset=${offset}${status ? "&status=" + status : ""}${legacy ? "&legacy=true" : ""}${subject ? "&subject=" + subject : ""}`,
    )
      .then((r) => {
        if (live) {
          setData(r);
          setError("");
        }
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [status, offset, subject, legacy, search]);
  return (
    <>
      {error && <p role="alert">{error}</p>}
      {data.items.map((t) => (
        <article className="history-row" key={t.id}>
          <button className="task-title" onClick={() => setSelected(t.id)}>
            {t.title}
          </button>
          <p>
            {s.subjects.find((x) => x.id === t.subject_id)?.name ?? "未分類"} ·{" "}
            {i18n(s.locale).status[t.status]} ·{" "}
            {t.completed_at || t.cancelled_at
              ? humanDate((t.completed_at || t.cancelled_at)!, s.locale)
              : "v0.2 前，精確時間未知"}
          </p>
          {t.status === "COMPLETED" && <NextTask t={t} />}
        </article>
      ))}
      {!data.items.length && <p className="muted">沒有符合的任務。</p>}
      <Pager offset={offset} more={data.hasMore} setOffset={setOffset} />
    </>
  );
}
export function HistoryPage() {
  const { s, setSelected } = useUI();
  const [kind, setKind] = useState("tasks"),
    [period, setPeriod] = useState("all"),
    [subject, setSubject] = useState(""),
    [offset, setOffset] = useState(0),
    [revision, setRevision] = useState(0),
    [error, setError] = useState("");
  const [data, setData] = useState<{
    items: any[];
    hasMore: boolean;
    completedThisMonth?: number;
  }>({ items: [], hasMore: false });
  useEffect(() => {
    let live = true;
    setError("");
    api(
      `/history/${kind}?period=${period}&offset=${offset}${subject ? "&subject=" + subject : ""}`,
    )
      .then((r) => live && setData(r))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [kind, period, subject, offset, revision]);
  const change = (set: (v: string) => void, v: string) => {
    setData({ items: [], hasMore: false });
    set(v);
    setOffset(0);
  };
  return (
    <>
      <div className="tabs">
        {[
          ["tasks", "任務紀錄"],
          ["reviews", "複習紀錄"],
        ].map(([v, l]) => (
          <button
            key={v}
            className={kind === v ? "selected" : ""}
            onClick={() => change(setKind, v)}
          >
            {l}
          </button>
        ))}
      </div>
      {kind === "reviews" && (
        <ManualReview onSaved={() => setRevision((v) => v + 1)} />
      )}
      <div className="history-filters">
        <div className="tabs">
          {[
            ["all", "全部"],
            ["week", "本週"],
            ["month", "本月"],
          ].map(([v, l]) => (
            <button
              key={v}
              className={period === v ? "selected" : ""}
              onClick={() => change(setPeriod, v)}
            >
              {l}
            </button>
          ))}
        </div>
        <label>
          科目篩選
          <select
            value={subject}
            onChange={(e) => change(setSubject, e.target.value)}
          >
            <option value="">所有科目</option>
            {s.subjects.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {kind === "tasks" ? (
        <>
          <p>
            本月完成 <strong>{data.completedThisMonth ?? 0}</strong> 個任務{" "}
            <span className="muted">· 按實際完成時間</span>
          </p>
          {data.items.map((e) => (
            <div key={e.id}>
              <span className="muted">
                {s.subjects.find((x) => x.id === e.subject_id)?.name}
              </span>
              <EventRow event={e} open={() => setSelected(e.task_id)} />
            </div>
          ))}
        </>
      ) : (
        <ReviewRows reviews={data.items} />
      )}
      {!data.items.length && kind === "tasks" && (
        <p className="muted">此期間尚無任務事件。</p>
      )}
      <Pager offset={offset} more={data.hasMore} setOffset={setOffset} />
      {kind === "tasks" && period === "all" && (
        <details>
          <summary>v0.2 前時間未知的已結束任務</summary>
          <ArchiveTasks legacy subject={subject} />
        </details>
      )}
    </>
  );
}
