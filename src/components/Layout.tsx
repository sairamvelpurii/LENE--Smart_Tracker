import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, LogOut, Upload, List } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/upload", label: "Upload", icon: Upload, end: false },
  { to: "/transactions", label: "Transactions", icon: List, end: false },
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-5">
          <p className="text-lg font-bold tracking-tight text-slate-900">LENE</p>
          <p className="text-xs text-slate-500">Smart finance tracker · ₹</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-indigo-50 text-indigo-800"
                    : "text-slate-600 hover:bg-slate-50"
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <p className="truncate text-xs text-slate-500" title={user?.email}>
            {user?.name ?? user?.email}
          </p>
          <p className="truncate text-[11px] text-slate-400">{user?.email}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto p-6 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
