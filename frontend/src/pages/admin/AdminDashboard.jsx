import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Ticket as TicketIcon, Users, Activity, AlertTriangle,
  PlusCircle, ArrowUpRight, Clock
} from "lucide-react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { StatusBadge, STATUS_LABEL, formatDate } from "../../lib/status";

const STAT_CARDS = [
  { key: "open", label: "Open" },
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
];

export default function AdminDashboard() {
  const [data, setData] = useState(() => {
    try {
      const cached = localStorage.getItem("dashboard");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  // Keep hooks ABOVE any early return
  useEffect(() => {
    const load = async () => {
      try {
        const { data: fresh } = await api.get("/dashboard/admin");
        setData(fresh);
        localStorage.setItem("dashboard", JSON.stringify(fresh));
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      }
    };

    load();
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/3"></div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  // Derive counts from the API response shape
  const counts = data.ticket_counts ?? {};
  const recentActivity = data.recent_activity ?? [];
  const warrantyAlerts = data.warranty_alerts ?? [];

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Overview</div>
          <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tight text-navy mt-1">
            Live operations
          </h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2 text-sm">
            <span className="pulse-dot" /> Realtime — auto-refresh every 12s
          </p>
        </div>
        <Link to="/admin/tickets/new">
          <Button className="bg-navy hover:bg-navy/90 text-white font-semibold rounded-md h-11"
                  data-testid="admin-new-ticket-btn">
            <PlusCircle className="w-4 h-4 mr-2" /> New Service Ticket
          </Button>
        </Link>
      </div>

      {/* Big stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((s, i) => (
          <motion.div
            key={s.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className={`p-5 border-l-4 hover-lift rounded-md border-status-${s.key}`}
                  data-testid={`stat-${s.key}`}>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500 font-bold">
                {s.label}
              </div>
              <div className="mt-2 font-display font-black text-4xl text-navy">
                {counts[s.key] || 0}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">tickets</div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Secondary row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Engineers */}
        <Card className="p-6 rounded-md">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500 font-bold">Engineers</div>
              <div className="font-display font-black text-4xl text-navy mt-2">
                {data.engineers.available}<span className="text-slate-300 text-2xl">/{data.engineers.total}</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">available right now</div>
            </div>
            <div className="w-12 h-12 rounded-md bg-slate-50 grid place-items-center">
              <Users className="w-5 h-5 text-navy" />
            </div>
          </div>
          <Link to="/admin/engineers" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-signal hover:underline">
            Manage engineers <ArrowUpRight className="w-3 h-3" />
          </Link>
        </Card>

        {/* All status breakdown */}
        <Card className="p-6 rounded-md lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500 font-bold">Status pipeline</div>
            <Link to="/admin/tickets" className="text-xs font-semibold text-signal hover:underline">
              View board →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.keys(STATUS_LABEL).filter((s) => s !== "rejected").map((s) => (
              <div key={s} className={`p-3 rounded-md bg-slate-50 border-l-2 border-status-${s}`}>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  {STATUS_LABEL[s]}
                </div>
                <div className="font-mono font-bold text-2xl text-navy mt-1">
                  {counts[s] || 0}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Activity + Warranty alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 rounded-md lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-navy" />
              <div className="font-bold">Recent activity</div>
            </div>
            <div className="text-xs text-slate-500">{recentActivity.length} events</div>
          </div>
          <div className="divide-y divide-slate-100">
            {recentActivity.length === 0 && (
              <div className="py-8 text-center text-sm text-slate-500">No activity yet</div>
            )}
            {recentActivity.map((a) => (
              <div key={a.id} className="py-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 grid place-items-center text-xs font-bold text-navy">
                  {a.actor_name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    <span className="font-semibold">{a.actor_name}</span>{" "}
                    <span className="text-slate-500">— {a.action.replace(/_/g, " ")}</span>
                  </div>
                  {a.details && <div className="text-xs text-slate-500 truncate">{a.details}</div>}
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1 whitespace-nowrap">
                  <Clock className="w-3 h-3" />
                  {formatDate(a.timestamp)}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 rounded-md">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <div className="font-bold">Warranty expiring</div>
          </div>
          {warrantyAlerts.length === 0 && (
            <div className="text-sm text-slate-500">All good for the next 30 days.</div>
          )}
          <div className="space-y-3">
            {warrantyAlerts.map((d) => (
              <div key={d.device_id} className="p-3 rounded-md bg-amber-50 border border-amber-100">
                <div className="text-xs font-mono text-amber-800 font-bold">{d.device_id}</div>
                <div className="text-sm font-semibold text-navy">{d.brand} {d.model}</div>
                <div className="text-xs text-slate-600">Expires {d.warranty_expiry}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}