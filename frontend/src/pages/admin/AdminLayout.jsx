import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Ticket, Users, Cpu, BarChart3, Map, LogOut, Bell, Menu, X,
  Building2, UserCog, History
} from "lucide-react";
import { useAuth } from "../../lib/auth";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger
} from "../../components/ui/popover";

const ADMIN_NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/tickets", label: "Tickets", icon: Ticket },
  { to: "/admin/companies", label: "Companies", icon: Building2 },
  { to: "/admin/engineers", label: "Engineers", icon: Users },
  { to: "/admin/devices", label: "Devices", icon: Cpu },
  { to: "/admin/device-history", label: "Device History", icon: History },
  { to: "/admin/live", label: "Live Map", icon: Map },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/sub-admins", label: "Sub-Admins", icon: UserCog, adminOnly: true },
];

const SUB_ADMIN_NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/tickets", label: "Tickets", icon: Ticket },
  { to: "/admin/companies", label: "Companies", icon: Building2 },
  { to: "/admin/engineers", label: "Engineers", icon: Users },
  { to: "/admin/device-history", label: "Device History", icon: History },
  { to: "/admin/analytics", label: "My Analytics", icon: BarChart3 },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const [openSidebar, setOpenSidebar] = useState(false);
  const [notes, setNotes] = useState([]);
  const nav = useNavigate();

  const loadNotes = async () => {
    try {
      const { data } = await api.get("/notifications");
      setNotes(data);
    } catch {}
  };

  useEffect(() => {
    loadNotes();
    const t = setInterval(loadNotes, 15000);
    return () => clearInterval(t);
  }, []);

  const unread = notes.filter((n) => !n.read).length;

  if (!user || user === false || !["admin", "sub_admin"].includes(user.role)) {
    if (user === false) nav("/login");
    return null;
  }
  const NAV = user.role === "admin" ? ADMIN_NAV : SUB_ADMIN_NAV;

  return (
    <div className="min-h-screen flex bg-white">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-[#0A1128] text-white flex flex-col transition-transform ${
          openSidebar ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
        data-testid="admin-sidebar"
      >
        <div className="p-6 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-white grid place-items-center p-1">
              <img src="/assets/plutus_logo.jpeg" alt="Plutus" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="font-display font-black tracking-tight">Plutus Ventures</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">IT Service Console</div>
            </div>
          </div>
          <button className="lg:hidden text-white/60" onClick={() => setOpenSidebar(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={() => setOpenSidebar(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#2563EB] text-white"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`
              }
              data-testid={`admin-nav-${n.label.toLowerCase().replace(/\s/g, "-")}`}
            >
              <n.icon className="w-4 h-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-[#2563EB] grid place-items-center font-bold text-sm">
              {user.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{user.name}</div>
              <div className="text-[11px] text-white/50 truncate">{user.email}</div>
            </div>
          </div>
          <Button
            onClick={logout}
            variant="ghost"
            className="w-full justify-start text-white/70 hover:text-white hover:bg-white/5"
            data-testid="admin-logout-btn"
          >
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 border-b border-slate-200">
          <div className="px-4 sm:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button className="lg:hidden" onClick={() => setOpenSidebar(true)}>
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Control Room</div>
                <div className="font-display font-bold text-sm">Live Operations</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="relative w-10 h-10 rounded-md hover:bg-slate-100 grid place-items-center"
                    data-testid="admin-notifications-btn"
                  >
                    <Bell className="w-5 h-5 text-slate-700" />
                    {unread > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <div className="p-3 border-b border-slate-200 flex items-center justify-between">
                    <div className="font-bold text-sm">Notifications</div>
                    <span className="text-xs text-slate-500">{unread} unread</span>
                  </div>
                  <div className="max-h-80 overflow-auto">
                    {notes.length === 0 && (
                      <div className="p-6 text-center text-sm text-slate-500">No notifications</div>
                    )}
                    {notes.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 border-b border-slate-100 text-sm ${n.read ? "" : "bg-blue-50/40"}`}
                      >
                        <div className="font-semibold text-navy text-sm">{n.title}</div>
                        {n.body && <div className="text-xs text-slate-500 mt-0.5">{n.body}</div>}
                        <div className="text-[10px] text-slate-400 mt-1">
                          {new Date(n.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8" data-testid="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}