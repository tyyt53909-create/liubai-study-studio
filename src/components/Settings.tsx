import { Bell, CalendarClock, Copy, KeyRound, Languages, LogOut } from "lucide-react";
import { useState } from "react";
import type { Reminder, Routine, Task } from "../../shared/domain";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";

import { api } from "../lib/api";
import { useUI } from "../lib/context";
import { humanDate } from "../lib/time";

const PRESET_DAYS: Record<string, Routine["days"]> = {
  weekday: [
    { english: 0, flexible: 240, start: "10:00" },
    { english: 120, flexible: 120, start: "18:00" },
    { english: 120, flexible: 120, start: "18:00" },
    { english: 120, flexible: 120, start: "18:00" },
    { english: 120, flexible: 120, start: "18:00" },
    { english: 120, flexible: 120, start: "18:00" },
    { english: 0, flexible: 240, start: "10:00" },
  ],
  weekend: [
    { english: 60, flexible: 300, start: "10:00" },
    { english: 120, flexible: 120, start: "18:00" },
    { english: 120, flexible: 120, start: "18:00" },
    { english: 120, flexible: 120, start: "18:00" },
    { english: 120, flexible: 120, start: "18:00" },
    { english: 120, flexible: 120, start: "18:00" },
    { english: 60, flexible: 300, start: "10:00" },
  ],
  light: [
    { english: 0, flexible: 120, start: "10:00" },
    { english: 60, flexible: 90, start: "19:00" },
    { english: 60, flexible: 90, start: "19:00" },
    { english: 60, flexible: 90, start: "19:00" },
    { english: 60, flexible: 90, start: "19:00" },
    { english: 60, flexible: 90, start: "19:00" },
    { english: 0, flexible: 120, start: "10:00" },
  ],
};

export function RoutineSettings() {
  const { s, busy, day, run, setSelected, setNotice } = useUI();
  const dict = t(s.locale);
  const st = dict.settings;
  const [routine, setRoutine] = useState<Routine>(structuredClone(s.routine));
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const permission =
    typeof Notification === "undefined" ? "unsupported" : Notification.permission;

  const upcoming = s.reminders
    .filter((r) => r.status !== "delivered")
    .map((r) => ({
      reminder: r,
      task: s.tasks.find((t) => t.id === r.task_id),
    }))
    .filter((x): x is { reminder: Reminder; task: Task } => Boolean(x.task))
    .sort((a, b) => a.reminder.due_at.localeCompare(b.reminder.due_at))
    .slice(0, 8);

  const presets = [
    { key: "weekday", label: st.presetWeekday, days: PRESET_DAYS.weekday },
    { key: "weekend", label: st.presetWeekend, days: PRESET_DAYS.weekend },
    { key: "light", label: st.presetLight, days: PRESET_DAYS.light },
  ];

  async function notifications() {
    if (!("Notification" in window) || !("serviceWorker" in navigator))
      throw new Error(
        s.locale === "en"
          ? "This browser does not support notifications. Use a supported browser over HTTPS/localhost."
          : "此瀏覽器不支援通知，請使用支援的瀏覽器及 HTTPS／localhost",
      );
    const next = await Notification.requestPermission();
    if (next !== "granted")
      throw new Error(
        s.locale === "en"
          ? "Notifications are not allowed. Enable them in browser site settings."
          : "通知尚未允許，請在瀏覽器網站設定開啟權限",
      );
    const reg = await navigator.serviceWorker.ready;
    if (s.pushKey) {
      const padding = "=".repeat((4 - (s.pushKey.length % 4)) % 4),
        raw = atob((s.pushKey + padding).replace(/-/g, "+").replace(/_/g, "/"));
      const key = Uint8Array.from(raw, (c) => c.charCodeAt(0));
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
      await api("/push/subscribe", "POST", subscription.toJSON());
    }
    setNotice(s.pushKey ? st.pushEnabled : st.pageEnabled);
  }

  async function testNotification() {
    if (!("Notification" in window))
      throw new Error(s.locale === "en" ? "This browser does not support notifications" : "此瀏覽器不支援通知");
    if (Notification.permission !== "granted")
      throw new Error(s.locale === "en" ? "Enable browser notifications first" : "請先啟用瀏覽器通知");
    new Notification(s.locale === "en" ? "Liubai · test notification" : "留白 · 測試通知", {
      body:
        s.locale === "en"
          ? "Notifications can be shown. Timed reminders will use the same path."
          : "通知已可顯示。到點提醒會用同一種方式送到你這裡。",
      tag: "study-test-notification",
    });
    setNotice(st.testSent);
  }

  function applyWeekdayFrom(sourceIndex: number) {
    const source = routine.days[sourceIndex];
    setRoutine({
      ...routine,
      days: routine.days.map((d, i) => (i === 0 || i === 6 ? d : { ...source })),
    });
    setNotice(st.appliedWeekdays(dict.weekdays[sourceIndex]));
  }

  function applyAllFrom(sourceIndex: number) {
    const source = routine.days[sourceIndex];
    setRoutine({
      ...routine,
      days: routine.days.map(() => ({ ...source })),
    });
    setNotice(st.appliedAll(dict.weekdays[sourceIndex]));
  }

  function setLocale(locale: Locale) {
    if (locale === s.locale) return;
    run(
      () => api("/locale", "PUT", { locale }),
      () => setNotice(st.languageSaved),
    );
  }

  return (
    <>
      <section className="settings-section">
        <h2>{st.routineTitle}</h2>
        <p>{st.routineHelp}</p>
        <div className="settings-actions">
          {presets.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className="small"
              disabled={busy}
              onClick={() => {
                setRoutine({ days: structuredClone(preset.days) });
                setNotice(st.appliedPreset(preset.label));
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => api("/routine", "PUT", routine),
              () => setNotice(st.routineSaved),
            );
          }}
        >
          <div className="routine-header">
            <span>{st.weekday}</span>
            <span>{st.englishMin}</span>
            <span>{st.flexibleMin}</span>
            <span>{st.startTime}</span>
            <span>{st.quickApply}</span>
          </div>
          {routine.days.map((r, i) => (
            <div className="routine-row" key={i}>
              <strong>
                {dict.weekdays[i]}
                {i === new Date(`${day}T12:00:00+08:00`).getUTCDay() ? st.todayMark : ""}
              </strong>
              {(["english", "flexible", "start"] as const).map((key) => (
                <input
                  aria-label={`${dict.weekdays[i]} ${key === "english" ? st.englishMin : key === "flexible" ? st.flexibleMin : st.startTime}`}
                  key={key}
                  type={key === "start" ? "time" : "number"}
                  min="0"
                  max="1440"
                  required
                  value={r[key]}
                  onChange={(e) =>
                    setRoutine({
                      ...routine,
                      days: routine.days.map((d, j) =>
                        j === i
                          ? {
                              ...d,
                              [key]:
                                key === "start" ? e.target.value : Number(e.target.value),
                            }
                          : d,
                      ),
                    })
                  }
                />
              ))}
              <div className="routine-quick">
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => applyWeekdayFrom(i)}
                  title={st.applyWeekdays}
                >
                  <Copy size={14} /> {st.applyWeekdays}
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => applyAllFrom(i)}
                  title={st.applyAll}
                >
                  {st.applyAll}
                </button>
              </div>
            </div>
          ))}
          <div className="form-footer">
            <span className="hint">{st.routineHint}</span>
            <button className="primary" disabled={busy}>
              {st.saveRoutine}
            </button>
          </div>
        </form>
      </section>

      <section className="settings-section">
        <h2>{st.remindersTitle}</h2>
        <p>{st.remindersHelp}</p>
        {upcoming.length ? (
          <div className="settings-reminder-list">
            {upcoming.map(({ reminder, task }) => (
              <button
                key={reminder.id}
                className="settings-reminder-row"
                onClick={() => setSelected(task.id)}
              >
                <CalendarClock size={18} />
                <span>
                  <strong>{task.title}</strong>
                  <small>
                    {humanDate(reminder.due_at, s.locale)} · {st.reminderStatus[reminder.status]}
                    {reminder.source === "fixed" ? ` · ${st.fixedSource}` : ` · ${st.manualSource}`}
                    {reminder.error ? ` · ${reminder.error}` : ""}
                  </small>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="empty-text">{st.noReminders}</p>
        )}
      </section>

      <section className="settings-section">
        <h2>{st.notifyTitle}</h2>
        <p>
          {st.notifyHelpExtra} {s.pushKey ? st.notifyHelpPush : st.notifyHelpPage}
        </p>
        <div className="settings-status-grid">
          <div>
            <span>{st.browserPermission}</span>
            <strong>
              {permission === "unsupported"
                ? st.unsupported
                : permission === "granted"
                  ? st.granted
                  : permission === "denied"
                    ? st.denied
                    : st.unset}
            </strong>
          </div>
          <div>
            <span>{st.pushMode}</span>
            <strong>{s.pushKey ? st.pushBg : st.pushPage}</strong>
          </div>
          <div>
            <span>{st.pendingCount}</span>
            <strong>{upcoming.length}</strong>
          </div>
        </div>
        <div className="settings-actions">
          <button disabled={busy} onClick={() => run(notifications)}>
            <Bell size={16} /> {st.enableNotify}
          </button>
          <button disabled={busy} onClick={() => run(testNotification)}>
            {st.testNotify}
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2>
          <Languages size={18} /> {st.languageTitle}
        </h2>
        <p>{st.languageHelp}</p>
        <div className="settings-actions language-options">
          <button
            type="button"
            className={"small" + (s.locale === "zh-Hant" ? " primary" : "")}
            disabled={busy}
            onClick={() => setLocale("zh-Hant")}
          >
            {st.traditional}
          </button>
          <button
            type="button"
            className={"small" + (s.locale === "en" ? " primary" : "")}
            disabled={busy}
            onClick={() => setLocale("en")}
          >
            {st.english}
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2>
          <KeyRound size={18} /> {st.passwordTitle}
        </h2>
        <p>{st.passwordHelp}</p>
        <form
          className="password-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (newPassword !== confirmPassword) {
              setNotice(st.passwordMismatch);
              return;
            }
            run(
              async () => {
                await api("/auth/password", "POST", {
                  current_password: currentPassword,
                  new_password: newPassword,
                });
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
              },
              () => setNotice(st.passwordChanged),
            );
          }}
        >
          <label>
            {st.currentPassword}
            <input
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <div className="form-row">
            <label>
              {st.newPassword}
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <label>
              {st.confirmPassword}
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
          </div>
          <div className="form-footer">
            <span className="hint">≥ 8</span>
            <button className="primary" disabled={busy || !currentPassword || !newPassword}>
              {st.changePassword}
            </button>
          </div>
        </form>
      </section>

      <section className="settings-section">
        <h2>{st.privateTitle}</h2>
        <p>{st.privateHelp}</p>
        <button
          onClick={async () => {
            try {
              await api("/auth/logout", "POST");
              window.dispatchEvent(new Event("study-auth-required"));
            } catch (e) {
              setNotice((e as Error).message);
            }
          }}
        >
          <LogOut size={16} /> {dict.logout}
        </button>
      </section>
    </>
  );
}
