import { Leaf } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";
import { t, type Locale } from "../lib/i18n";

export function Login({
  onLogin,
  locale = "zh-Hant",
}: {
  onLogin: () => void;
  locale?: Locale;
}) {
  const dict = t(locale);
  const [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="login-page">
      <form
        className="editor login-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api("/auth/login", "POST", { password });
            setPassword("");
            onLogin();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Leaf size={32} />
        <h1>{dict.loginTitle}</h1>
        <p className="muted">{dict.loginSub}</p>
        <label>
          {dict.password}
          <input
            autoFocus
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? dict.loggingIn : dict.login}
        </button>
      </form>
    </main>
  );
}
