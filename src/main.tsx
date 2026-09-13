import {
  BookOpen,
  CalendarDays,
  History,
  Layers,
  Leaf,
  Pause,
  Play,
  Plus,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Level, Snapshot, Task } from "../shared/domain";
import {
  addDays,
  capacity,
  finishEstimate,
  isoDay,
  weekStart,
} from "../shared/domain";
import { HistoryPage } from "./components/History";
import { Login } from "./components/Login";
import { PlanningPage } from "./components/Planning";
import { RoutineSettings } from "./components/Settings";
import { Subjects } from "./components/Subjects";
import { Detail } from "./components/TaskDetail";
import { Capture, TasksPage } from "./components/Tasks";
import { TodayPage } from "./components/Today";
import { api } from "./lib/api";
import { UIContext } from "./lib/context";
import { startNotifications } from "./lib/notifications";
import { timeText } from "./lib/time";
import { dateLocale, t } from "./lib/i18n";
import "./style.css";
const navKeys = [
  ["today", Sun],
  ["tasks", Layers],
  ["planning", CalendarDays],
  ["subjects", BookOpen],
  ["history", History],
  ["settings", Settings],
] as const;
function App() {
  const [authenticated, setAuthenticated] = useState(true);
  const [s, setS] = useState<Snapshot | null>(null),
    [page, setPage] = useState("today"),
    [selected, setSelected] = useState<string | null>(() => {
      const t = new URLSearchParams(location.search).get("task");
      return t && /^[0-9a-f-]{36}$/i.test(t) ? t : null;
    }),
    [capture, setCapture] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(Date.now()),
    [filter, setFilter] = useState("open"),
    [search, setSearch] = useState(""),
    [historyFilter, setHistoryFilter] = useState("all");
  const offset = useRef(0),
    fetchVersion = useRef(0);
  const [notice, setNotice] = useState("");
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  async function refresh() {
    const version = ++fetchVersion.current;
    const data = await api(
      "/state" +
        (selectedRef.current
          ? "?taskId=" + encodeURIComponent(selectedRef.current)
          : ""),
    );
    if (version !== fetchVersion.current) return;
    offset.current = new Date(data.now).getTime() - Date.now();
    if (
      selectedRef.current &&
      !data.tasks.some((t: Task) => t.id === selectedRef.current)
    ) {
      setSelected(null);
      setNotice("找不到該任務，可能已不存在。");
    }
    setS(data);
    setNow(Date.now() + offset.current);
  }
  useEffect(() => {
    if (selected || capture) window.scrollTo({ top: 0, behavior: "instant" });
  }, [selected, capture]);
  useEffect(() => {
    if (!authenticated) return;
    refresh().catch((e) => setError(e.message));
    const tick = setInterval(() => setNow(Date.now() + offset.current), 1000);
    const poll = setInterval(() => refresh().catch(() => {}), 15000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [authenticated]);
  useEffect(() => {
    const required = () => {
      setAuthenticated(false);
      setS(null);
    };
    window.addEventListener("study-auth-required", required);
    return () => window.removeEventListener("study-auth-required", required);
  }, []);
  useEffect(() => {
    if (authenticated) return startNotifications();
  }, [authenticated]);
  useEffect(() => {
    document.documentElement.lang = s?.locale === "en" ? "en" : "zh-Hant";
  }, [s?.locale]);
  useEffect(() => {
    if (authenticated) refresh().catch((e) => setError(e.message));
    const url = new URL(location.href);
    if (selected) url.searchParams.set("task", selected);
    else url.searchParams.delete("task");
    history.replaceState(null, "", url);
  }, [selected, authenticated]);
  useEffect(() => {
    const open = (e: MessageEvent) => {
      if (e.data?.type === "OPEN_TASK") {
        setSelected(e.data.taskId);
        setCapture(false);
      }
    };
    navigator.serviceWorker?.addEventListener("message", open);
    return () => navigator.serviceWorker?.removeEventListener("message", open);
  }, []);
  async function run(fn: () => Promise<unknown>, after?: () => void) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
      after?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function go(p: string) {
    setPage(p);
    setSelected(null);
    setCapture(false);
    setError("");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  const shellLocale = s?.locale ?? "zh-Hant";
  const dict = t(shellLocale);
  if (!authenticated)
    return (
      <Login
        locale={shellLocale}
        onLogin={() => {
          setError("");
          setAuthenticated(true);
        }}
      />
    );
  if (!s)
    return (
      <main className="loading">
        <Leaf />
        <h1>{dict.brand}</h1>
        <p>{error || dict.loading}</p>
        {error && (
          <button onClick={() => refresh().catch((e) => setError(e.message))}>
            {dict.reconnect}
          </button>
        )}
      </main>
    );
  const day = isoDay(new Date(now)),
    flex = capacity(s, day, "FLEXIBLE", now),
    eng = capacity(s, day, "ENGLISH", now),
    finish = finishEstimate(s, day, now);
  const active = s.sessions.find((x) =>
    ["RUNNING", "PAUSED"].includes(x.state),
  );
  const activeTask = s.tasks.find((t) => t.id === active?.task_id);
  const open = s.tasks.filter(
    (t) => !["COMPLETED", "CANCELLED"].includes(t.status),
  );
  const unscheduled = open.filter(
    (t) => s.plans.find((p) => p.task_id === t.id)?.level === "UNSCHEDULED",
  );
  const chosen = s.tasks.find((t) => t.id === selected);
  const sorted = (list: Task[]) =>
    [...list].sort((a, b) => {
      if (a.id === activeTask?.id) return -1;
      if (b.id === activeTask?.id) return 1;
      if ((a.priority_date === day) !== (b.priority_date === day))
        return a.priority_date === day ? -1 : 1;
      return b.created_at.localeCompare(a.created_at);
    });
  const planTask = (t: Task, level: Level, on_date = day) =>
    api("/tasks/" + t.id + "/plan", "PUT", {
      level,
      on_date: level === "UNSCHEDULED" ? null : on_date,
      fixed_time: level === "FIXED" ? "20:00" : null,
    });
  const togglePriority = (t: Task) =>
    api("/tasks/" + t.id + "/priority", "PUT", {
      priority_date: t.priority_date === day ? null : day,
    });
  let tasks = s.tasks
    .filter((t) => {
      const p = s.plans.find((p) => p.task_id === t.id)!;
      if (filter === "open") return open.includes(t);
      if (filter === "unscheduled")
        return open.includes(t) && p.level === "UNSCHEDULED";
      if (filter === "week")
        return (
          open.includes(t) &&
          ((p.level === "WEEK" && p.on_date === weekStart(day)) ||
            (["DAY", "FIXED"].includes(p.level) &&
              p.on_date! >= weekStart(day) &&
              p.on_date! < addDays(weekStart(day), 7)))
        );
      if (filter === "month")
        return open.includes(t) && p.on_date?.slice(0, 7) === day.slice(0, 7);
      if (filter === "progress") return t.status === "IN_PROGRESS";
      if (filter === "completed") return t.status === "COMPLETED";
      if (filter === "cancelled") return t.status === "CANCELLED";
      return open.includes(t) && p.level !== "UNSCHEDULED";
    })
    .filter((t) => t.title.toLowerCase().includes(search.toLowerCase()));
  return (
    <UIContext.Provider
      value={{
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
      }}
    >
      <div className="app-shell">
        <aside className="sidebar">
          <nav aria-label={s.locale === "en" ? "Main" : "主導覽"}>
            {navKeys.map(([key, Icon]) => (
              <button
                key={key}
                aria-current={page === key ? "page" : undefined}
                className={page === key ? "current" : ""}
                onClick={() => go(key)}
              >
                <Icon size={19} />
                <span>{dict.nav[key]}</span>
                {key === "tasks" && <small>{open.length}</small>}
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <span className="connection-dot" /> {dict.personalSpace}
            <p>{dict.brandFooter}</p>
            <button
              className="text-button"
              onClick={() =>
                run(async () => {
                  await api("/auth/logout", "POST");
                  setAuthenticated(false);
                  setS(null);
                })
              }
            >
              {dict.logout}
            </button>
          </div>
        </aside>
        <main className="main">
          <header className={"page-header" + (page === "subjects" ? " compact-header" : "")}>
            <div>
              <p className="date-line">
                {new Date(now).toLocaleDateString(dateLocale(s.locale), {
                  timeZone: "Asia/Hong_Kong",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                })}
              </p>
              {page !== "subjects" && <h1>{dict.nav[page as keyof typeof dict.nav]}</h1>}
            </div>
            {page === "tasks" && (
              <input
                type="search"
                aria-label="搜尋任務"
                className="search header-search"
                placeholder="找一個任務…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            )}
            <button
              className="primary"
              onClick={() => {
                setCapture(!capture);
                setSelected(null);
              }}
            >
              <Plus size={18} />
              <span>{dict.addTask}</span>
            </button>
          </header>
          {error && (
            <div className="error" role="alert">
              {error}
              <button aria-label="關閉錯誤" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button aria-label="關閉提示" onClick={() => setNotice("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {capture && (
            <Capture
              onSaved={(onDate) => {
                setCapture(false);
                setSearch("");
                setFilter(onDate ? "open" : "unscheduled");
                setNotice(onDate ? `任務已安排在 ${onDate}。` : "任務已存到未安排。");
              }}
            />
          )}
          {chosen && <Detail key={chosen.id} t={chosen} />}
          <div className={chosen ? "behind-detail" : ""}>
            {page === "today" && <TodayPage go={go} setFilter={setFilter} />}
            {page === "tasks" && (
              <TasksPage
                filter={filter}
                setFilter={setFilter}
                search={search}
                tasks={tasks}
              />
            )}
            {page === "planning" && <PlanningPage />}
            {page === "subjects" && <Subjects />}
            {page === "history" && <HistoryPage />}
            {page === "settings" && <RoutineSettings />}
          </div>
          <footer className="content-footer">留一點空間，給真正的學習。</footer>
        </main>
        {activeTask && (
          <div className="active-bar" aria-label="目前學習">
            <button
              className="active-title"
              onClick={() => {
                setSelected(activeTask.id);
                setCapture(false);
              }}
            >
              <span
                className={
                  active?.state === "RUNNING" ? "live-dot" : "paused-dot"
                }
              />
              <span>
                {activeTask.title}
                <small>
                  {active?.state === "RUNNING" ? "正在學習" : "已暫停"}
                </small>
              </span>
            </button>
            <strong>
              {timeText(
                (active?.elapsed_closed ?? 0) +
                  s.intervals
                    .filter((i) => i.session_id === active!.id)
                    .reduce(
                      (n, i) =>
                        n +
                        (new Date(i.end_at ?? now).getTime() -
                          new Date(i.start_at).getTime()) /
                          1000,
                      0,
                    ),
              )}
            </strong>
            <button
              disabled={busy}
              aria-label={
                active?.state === "RUNNING" ? "暫停目前學習" : "恢復目前學習"
              }
              onClick={() =>
                run(() =>
                  api("/tasks/" + activeTask.id + "/action", "POST", {
                    action: active?.state === "RUNNING" ? "pause" : "resume",
                  }),
                )
              }
            >
              {active?.state === "RUNNING" ? (
                <Pause size={17} />
              ) : (
                <Play size={17} />
              )}
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run(() =>
                  api("/tasks/" + activeTask.id + "/action", "POST", {
                    action: "stop",
                  }),
                )
              }
            >
              暫時停止
            </button>
          </div>
        )}
      </div>
    </UIContext.Provider>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
