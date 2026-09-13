import { api } from "./api";
export function startNotifications() {
  if (!("serviceWorker" in navigator)) return;
  let stopped = false,
    running = false;
  navigator.serviceWorker.register("/sw.js").catch(() => {});
  let deviceId = localStorage.getItem("study-device");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("study-device", deviceId);
  }
  const check = async () => {
    if (
      stopped ||
      running ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    )
      return;
    running = true;
    try {
      const reg = await navigator.serviceWorker.ready;
      const claims = await api("/reminders/claim", "POST", { deviceId });
      for (const data of claims)
        reg.active?.postMessage({ type: "REMINDER", data });
    } catch {
    } finally {
      running = false;
    }
  };
  const timer = setInterval(check, 5000);
  void check();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
