import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function AuthPage() {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to="/" replace />;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (mode === "login") login(email, password);
      else register(email, password, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-center text-2xl font-bold text-slate-900">LENE</h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          Personal finance for India · track spends in ₹
        </p>

        <div className="mt-6 flex rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            className={`flex-1 rounded-md py-2 text-sm font-medium ${
              mode === "login" ? "bg-white shadow text-slate-900" : "text-slate-600"
            }`}
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md py-2 text-sm font-medium ${
              mode === "register" ? "bg-white shadow text-slate-900" : "text-slate-600"
            }`}
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-xs font-medium text-slate-600">Name</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600">Email</label>
            <input
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Password</label>
            <input
              type="password"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>
          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <p className="mt-4 text-center text-[11px] text-slate-400">
          Local demo: passwords stored in browser storage only — not for production.
        </p>
      </div>
    </div>
  );
}
