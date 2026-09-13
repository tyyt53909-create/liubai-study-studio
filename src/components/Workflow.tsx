import { useState } from "react";
import { addDays, weekStart, type Task, type Level } from "../../shared/domain";
import { api } from "../lib/api";
import { useUI } from "../lib/context";

export function QuickMove({ t }: { t: Task }) {
  const { s, day, busy, run, setNotice } = useUI();
  const [date, setDate] = useState(day);
  const p = s.plans.find((p) => p.task_id === t.id)!;
  const move = (level: Level, on: string | null, label: string) =>
    run(
      () =>
        api(`/tasks/${t.id}/plan`, "PUT", {
          level: level === "DAY" && p.level === "FIXED" ? "FIXED" : level,
          on_date: on,
          fixed_time:
            level === "DAY" && p.level === "FIXED" ? p.fixed_time : null,
          remind_at_start:
            level === "DAY" && p.level === "FIXED" ? p.remind_at_start : false,
        }),
      () => setNotice(`已安排「${t.title}」：${label}`),
    );
  return (
    <details className="quick-move">
      <summary>改期</summary>
      <div className="move-options" aria-label={`快速改期 ${t.title}`}>
        {p.level === "FIXED" && (
          <p className="hint">
            移到某一天會保留 {p.fixed_time}
            ；移到週或未安排會取消指定時間與到點提醒。
          </p>
        )}
        <div className="move-buttons">
          <button disabled={busy} onClick={() => move("DAY", day, "今天")}>
            今天
          </button>
          <button
            disabled={busy}
            onClick={() => move("DAY", addDays(day, 1), "明天")}
          >
            明天
          </button>
          <button
            disabled={busy}
            onClick={() => move("WEEK", weekStart(day), "本週")}
          >
            本週
          </button>
          <button
            disabled={busy}
            onClick={() => move("WEEK", addDays(weekStart(day), 7), "下週")}
          >
            下週
          </button>
          <button
            disabled={busy}
            onClick={() => move("UNSCHEDULED", null, "未安排")}
          >
            取消安排
          </button>
        </div>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            void move("DAY", date, date);
          }}
        >
          <label>
            選擇日期
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <button disabled={busy}>移到此日期</button>
        </form>
      </div>
    </details>
  );
}

export function NextTask({ t }: { t: Task }) {
  const { busy, run, setSelected, setNotice } = useUI();
  const [follow, setFollow] = useState(false),
    [title, setTitle] = useState("");
  const save = (mode: "follow-up" | "again") =>
    run(async () => {
      const next = await api(`/tasks/${t.id}/copy`, "POST", {
        mode,
        ...(mode === "follow-up" ? { title } : {}),
      });
      setSelected(next.id);
      setNotice("新任務已存到未安排。");
    });
  return (
    <div className="next-task" aria-label="完成後的下一步">
      <div className="move-buttons">
        <button disabled={busy} onClick={() => setFollow(!follow)}>
          新增後續任務
        </button>
        <button disabled={busy} onClick={() => save("again")}>
          再做一次
        </button>
      </div>
      {follow && (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save("follow-up");
          }}
        >
          <label>
            下一步要做什麼？
            <input
              autoFocus
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：重做 Q4、Q7"
            />
          </label>
          <button className="primary" disabled={busy || !title.trim()}>
            儲存後續任務
          </button>
        </form>
      )}
    </div>
  );
}
