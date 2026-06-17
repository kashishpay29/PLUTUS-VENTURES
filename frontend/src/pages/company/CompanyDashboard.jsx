import React, { useState } from "react";
import { Link } from "react-router-dom";
import { getCachedJson, readCachedJson } from "../../lib/api";
import { useSmartPolling } from "../../hooks/useSmartPolling";
import { Card } from "../../components/ui/card";
import { StatusBadge, STATUS_LABEL, formatDate } from "../../lib/status";
import { AlertTriangle, Ticket, PlusCircle } from "lucide-react";
import { Button } from "../../components/ui/button";

const CACHE_KEY = "company-dashboard";

const STAT_CARDS = [
  { key: "total",     label: "Total",       status: "all" },
  { key: "open",      label: "Open",        status: "open" },
  { key: "active",    label: "In Progress", status: "in_progress" },
  { key: "completed", label: "Completed",   status: "closed" },
  { key: "rejected",  label: "Failed",      status: "rejected" },
];

export default function CompanyDashboard() {
  const [data, setData] = useState(() => readCachedJson(CACHE_KEY));

  const load = async () => {
    try {
      const fresh = await getCachedJson("/dashboard/company", {
        ttl: 30000,
        storageKey: CACHE_KEY,
      });
      setData(fresh);
    } catch (err) {
      console.error("Company dashboard fetch error:", err);
    }
  };

  useSmartPolling(load, 30000);

  if (!data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/3" />
        <div className="grid grid-cols-5 gap-4">
          {[1,2,3,4,5].map((i) => <div key={i} className="h-24 bg-slate-200 rounded" />)}
        </div>
      </div>
    );
  }

  const counts = data.ticket_counts ?? {};
  const recent = data.recent_tickets ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Overview</div>
          <h1 className="font-display font-black text-3xl tracking-tight text-navy mt-1">Dashboard</h1>
        </div>
        <Link to="/company/tickets/new">
          <Button className="bg-navy hover:bg-navy/90 text-white font-semibold rounded-md">
            <PlusCircle className="w-4 h-4 mr-2" /> New Ticket
          </Button>
        </Link>
      </div>

      {/* Stat cards — all clickable */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {STAT_CARDS.map((s) => (
          <Link key={s.key} to={`/company/tickets${s.status !== "all" ? `?status=${s.status}` : ""}`}>
            <Card className={`p-5 border-l-4 hover-lift rounded-md cursor-pointer hover:shadow-md transition-shadow border-status-${s.key}`}>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500 font-bold">{s.label}</div>
              <div className="mt-2 font-display font-black text-4xl text-navy">
                {counts[s.key] ?? 0}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">tickets →</div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent tickets */}
        <Card className="p-6 rounded-md lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Ticket className="w-4 h-4 text-navy" />
              <div className="font-bold">Recent Tickets</div>
            </div>
            <Link to="/company/tickets" className="text-xs font-semibold text-signal hover:underline">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recent.length === 0 && (
              <div className="py-8 text-center text-sm text-slate-500">No tickets yet</div>
            )}
            {recent.map((t) => (
              <Link key={t.id} to={`/company/tickets/${t.id}`}>
                <div className="py-3 flex items-center justify-between hover:bg-slate-50 rounded px-2 -mx-2">
                  <div>
                    <div className="font-mono font-bold text-xs text-signal">{t.ticket_no || t.ticket_number}</div>
                    <div className="text-sm font-semibold text-navy">{t.customer_name}</div>
                    <div className="text-xs text-slate-500">{t.assigned_engineer_name || "Unassigned"}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={t.status} />
                    <div className="text-[10px] text-slate-400">{formatDate(t.created_at)}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        {/* Open issues */}
        <Card className="p-6 rounded-md">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <div className="font-bold">Open Issues</div>
          </div>
          <div className="text-4xl font-display font-black text-navy">
            {data.open_issues ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">reported by engineers</div>
          <Link to="/company/tickets" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-signal hover:underline">
            View tickets →
          </Link>
        </Card>
      </div>
    </div>
  );
}
