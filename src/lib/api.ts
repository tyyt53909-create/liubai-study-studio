export async function api(path: string, method = "GET", data?: unknown) {
  const r = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const b = await r.json();
  if (r.status === 401) window.dispatchEvent(new Event("study-auth-required"));
  if (!r.ok)
    throw new Error(b.error + (b.details ? "：" + b.details.join("；") : ""));
  return b;
}
