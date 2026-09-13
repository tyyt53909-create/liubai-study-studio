import { BookOpen, Plus } from "lucide-react";
import { useState } from "react";
import type { Snapshot } from "../../shared/domain";
import { fmtMin } from "../../shared/domain";

import { api } from "../lib/api";
import { useUI } from "../lib/context";
import { humanDate, localDateTime } from "../lib/time";
export function ReviewRows({ reviews }: { reviews: Snapshot["reviews"] }) {
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
  return reviews.length ? (
    <div className="review-list">
      {[...reviews]
        .sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at))
        .map((r) => (
          <article key={r.id} className="review-row">
            <div className="review-icon">
              <BookOpen size={18} />
            </div>
            <div>
              <strong>
                {s!.subjects.find((x) => x.id === r.subject_id)?.name}
                {r.topic_id
                  ? " · " + s!.topics.find((x) => x.id === r.topic_id)?.name
                  : ""}
              </strong>
              <p>
                {humanDate(r.reviewed_at)} ·{" "}
                {r.source === "SESSION" ? "學習自動紀錄" : "手動補記"}
              </p>
              {r.note && <p>{r.note}</p>}
            </div>
            <span>
              {r.duration === null ? "未填時長" : fmtMin(r.duration) + " 分鐘"}
            </span>
          </article>
        ))}
    </div>
  ) : (
    <p className="empty-text">
      還沒有複習紀錄。完成一次複習學習後，紀錄會留在這裡。
    </p>
  );
}
export function ManualReview({ onSaved }: { onSaved?: () => void } = {}) {
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
  const [subject, setSubject] = useState(s!.subjects[0].id),
    [topic, setTopic] = useState(""),
    [when, setWhen] = useState(localDateTime()),
    [duration, setDuration] = useState(""),
    [note, setNote] = useState("");
  return (
    <details className="manual-review">
      <summary>
        <Plus size={16} /> 補記一次複習
      </summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              api("/reviews", "POST", {
                subject_id: subject,
                topic_id: topic || null,
                reviewed_at: new Date(when + ":00+08:00").toISOString(),
                duration: duration ? Number(duration) : null,
                note,
              }),
            () => {
              setNote("");
              setNotice("複習紀錄已儲存");
              onSaved?.();
            },
          );
        }}
      >
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
              {s!.subjects.map((x) => (
                <option value={x.id} key={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Topic
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="">未分類</option>
              {s!.topics
                .filter((x) => x.subject_id === subject)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            複習時間
            <input
              type="datetime-local"
              required
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </label>
          <label>
            分鐘（可選）
            <input
              type="number"
              min="0"
              max="1440"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </label>
        </div>
        <label>
          備註
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button className="primary" disabled={busy}>
          儲存複習紀錄
        </button>
      </form>
    </details>
  );
}
