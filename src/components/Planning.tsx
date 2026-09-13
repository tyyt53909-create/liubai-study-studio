import { addDays, planIncludes, weekStart } from "../../shared/domain";

import { useUI } from "../lib/context";
import { List } from "./Tasks";

export function PlanningPage() {
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
      <section className="planning-pool">
        <div className="section-heading">
          <h2>本月與本週待安排</h2>
          <span className="muted">點開任務調整日期</span>
        </div>
        <List
          tasks={open.filter((t) =>
            s.plans.some(
              (p) =>
                p.task_id === t.id &&
                ["MONTH", "WEEK"].includes(p.level) &&
                planIncludes(p, day),
            ),
          )}
          add
        />
      </section>
      <div className="week-list">
        {Array.from({ length: 7 }, (_, i) => addDays(weekStart(day), i)).map(
          (d) => (
            <section
              key={d}
              className={"day-section " + (d === day ? "is-today" : "")}
            >
              <div className="day-heading">
                <h3>
                  {new Date(`${d}T12:00:00+08:00`).toLocaleDateString("zh-HK", {
                    weekday: "short",
                    month: "numeric",
                    day: "numeric",
                  })}
                </h3>
                <span>{d === day ? "今天" : d}</span>
              </div>
              <List
                tasks={s.tasks.filter(
                  (t) =>
                    t.status !== "CANCELLED" &&
                    s.plans.some(
                      (p) =>
                        p.task_id === t.id &&
                        ["DAY", "FIXED"].includes(p.level) &&
                        p.on_date === d,
                    ),
                )}
              />
            </section>
          ),
        )}
      </div>
    </>
  );
}
