import React from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Ticket, BarChart2, Monitor, LogOut, Building2,
} from "lucide-react";
import { useAuth } from "../../lib/auth";

const NAV = [
  { to: "/company",           icon: LayoutDashboard, label: "Dashboard",  end: true },
  { to: "/company/tickets",   icon: Ticket,          label: "Tickets" },
  { to: "/company/analytics", icon: BarChart2,       label: "Analytics" },
  { to: "/company/devices",   icon: Monitor,         label: "Devices" },
];

export default function CompanyLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-navy text-white flex flex-col fixed inset-y-0 left-0 z-20">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-signal" />
            <div>
              <div className="font-bold text-sm leading-tight">{user?.company_name || "Company Portal"}</div>
              <div className="text-[10px] text-white/50 uppercase tracking-wider">Admin</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive ? "bg-signal text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="px-3 py-2 text-xs text-white/50">{user?.name}</div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white/70 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-56 p-6 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
