import { BookOpen, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Snapshot } from "../../shared/domain";
import { latestReviews } from "../../shared/domain";

import { api } from "../lib/api";
import { useUI } from "../lib/context";
import { humanDate } from "../lib/time";
import { ReviewRows } from "./Reviews";
import { List } from "./Tasks";
export function Subjects() {
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
    [name, setName] = useState(""),
    [addingSubject, setAddingSubject] = useState(false);
  const [reviewData, setReviewData] = useState<{
    latest: Snapshot["reviews"];
    recent: Snapshot["reviews"];
  }>({ latest: [], recent: [] });
  const [reviewError, setReviewError] = useState("");
  useEffect(() => {
    let live = true;
    api("/subjects/" + subject + "/reviews")
      .then((r) => {
        if (live) {
          setReviewData(r);
          setReviewError("");
        }
      })
      .catch((e) => live && setReviewError(e.message));
    return () => {
      live = false;
    };
  }, [subject]);
  const subj = s!.subjects.find((x) => x.id === subject)!;
  const recent = latestReviews(reviewData.latest, subject);
  return (
    <>
      <section className="subject-header">
        <div className={"subject-symbol " + subj.color}>
          <BookOpen size={26} />
        </div>
        <div>
          <h2>{subj.name}</h2>
          <p>
            {recent
              ? "上次複習：" + humanDate(recent.reviewed_at)
              : "尚未有複習紀錄"}
          </p>
        </div>
      </section>
      <div className="subject-tabs" aria-label="選擇科目">
        <div className="tabs">
          {s!.subjects.map((x) => (
            <button
              key={x.id}
              className={subject === x.id ? "selected" : ""}
              onClick={() => setSubject(x.id)}
            >
              {x.name}
            </button>
          ))}
          <button
            className="icon-button"
            aria-label="新增科目"
            title="新增科目"
            onClick={() => setAddingSubject(true)}
          >
            <Plus size={17} />
          </button>
        </div>
        {addingSubject && (
          <form
            className="inline-form add-subject-form"
            onSubmit={(e) => {
              e.preventDefault();
              let createdId = "";
              run(
                async () => {
                  const created = await api("/subjects", "POST", { name });
                  createdId = created.id;
                  setName("");
                  setAddingSubject(false);
                },
                () => setSubject(createdId),
              );
            }}
          >
            <label>
              科目名稱
              <input
                autoFocus
                aria-label="科目名稱"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：Physics"
              />
            </label>
            <button className="small primary" disabled={busy || !name.trim()}>
              新增
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label="取消新增科目"
              title="取消"
              onClick={() => {
                setName("");
                setAddingSubject(false);
              }}
            >
              <X size={17} />
            </button>
          </form>
        )}
      </div>
      {reviewError && <p role="alert">{reviewError}</p>}
      <h3>Topic 記憶</h3>
      <div className="topic-list">
        {s!.topics
          .filter((x) => x.subject_id === subject)
          .map((x) => {
            const last = latestReviews(reviewData.latest, subject, x.id);
            return (
              <div key={x.id}>
                <strong>{x.name}</strong>
                <span>{last ? humanDate(last.reviewed_at) : "尚未複習"}</span>
              </div>
            );
          })}
      </div>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => api("/topics", "POST", { subject_id: subject, name: topic }),
            () => setTopic(""),
          );
        }}
      >
        <input
          aria-label="新增 Topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="新增長期學習分類"
        />
        <button disabled={busy || !topic.trim()}>新增 Topic</button>
      </form>
      <div className="section-heading">
        <h3>未完成任務</h3>
      </div>
      <List tasks={open.filter((t) => t.subject_id === subject)} add />
      <div className="section-heading">
        <h3>最近複習</h3>
      </div>
      <ReviewRows
        reviews={[...reviewData.recent]
          .filter((r) => r.subject_id === subject)
          .sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at))
          .slice(0, 10)}
      />
    </>
  );
}
