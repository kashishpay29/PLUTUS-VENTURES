import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutGrid, ListChecks, User as UserIcon, Bell, LogOut, ClipboardList
} from "lucide-react";
import { useAuth } from "../../lib/auth";
import { api } from "../../lib/api";
import { Toaster } from "../../components/ui/sonner";

const NAV = [
  { to: "/engineer", label: "Home", icon: LayoutGrid, end: true },
  { to: "/engineer/tickets", label: "Tickets", icon: ListChecks },
  { to: "/engineer/attendance", label: "Attendance", icon: ClipboardList },
  { to: "/engineer/profile", label: "Profile", icon: UserIcon },
];

export default function EngineerLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [notes, setNotes] = useState([]);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    if (user && user !== false && user.role === "engineer") {
      const load = async () => {
        try { const { data } = await api.get("/notifications"); setNotes(data); } catch {}
      };
      load();
      const t = setInterval(load, 12000);
      return () => clearInterval(t);
    }
  }, [user]);

  if (!user || user === false || user.role !== "engineer") {
    if (user === false) nav("/login");
    return null;
  }

  const unread = notes.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-slate-50 max-w-[480px] mx-auto relative">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-[#0A1128] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-md bg-white grid place-items-center p-1">
            <img src="/assets/plutus_logo.jpeg" alt="Plutus" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/60">Engineer • Plutus</div>
            <div className="font-display font-bold text-sm">{user.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="relative w-10 h-10 rounded-md hover:bg-white/10 grid place-items-center"
            data-testid="engineer-notifications-btn"
          >
            <Bell className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cyan-400" />
            )}
          </button>
          <button onClick={logout} className="w-10 h-10 rounded-md hover:bg-white/10 grid place-items-center"
                  data-testid="engineer-logout-btn">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Notifications drawer */}
      {showNotes && (
        <div className="absolute top-14 right-2 w-72 bg-white rounded-md shadow-xl border border-slate-200 z-40 max-h-96 overflow-auto">
          <div className="p-3 border-b border-slate-200 font-bold text-sm">Notifications</div>
          {notes.length === 0 && <div className="p-6 text-center text-sm text-slate-500">No notifications</div>}
          {notes.map((n) => (
            <div key={n.id} className={`p-3 border-b border-slate-100 text-sm ${n.read ? "" : "bg-blue-50/40"}`}>
              <div className="font-semibold text-navy">{n.title}</div>
              {n.body && <div className="text-xs text-slate-500 mt-0.5">{n.body}</div>}
              <div className="text-[10px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      <main className="pb-24 min-h-[calc(100vh-56px)]" data-testid="engineer-main">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] grid grid-cols-4 z-40 pb-safe"
           data-testid="engineer-bottom-nav">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-3 text-[10px] font-bold uppercase tracking-wide ${
                isActive ? "text-signal" : "text-slate-400"
              }`
            }
            data-testid={`engineer-nav-${n.label.toLowerCase()}`}
          >
            <n.icon className="w-5 h-5 mb-1" />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
