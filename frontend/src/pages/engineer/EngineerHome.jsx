import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { Inbox, Wrench, CheckCircle2, ChevronRight } from "lucide-react";
import { StatusBadge, formatDate } from "../../lib/status";

export default function EngineerHome() {
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);

  const load = async () => {
    try {
      const [s, t] = await Promise.all([
        api.get("/dashboard/engineer"),
        api.get("/tickets"),
      ]);
      setStats(s.data);
      setTickets(t.data);
    } catch {}
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 10000);
    return () => clearInterval(i);
  }, []);

  if (!stats) return <div className="p-4 text-slate-500">Loading…</div>;

  const active = tickets.filter((t) =>
    ["assigned", "accepted", "travelling", "reached_site", "in_progress"].includes(t.status)
  );

  return (
    <div className="px-4 py-5 space-y-5" data-testid="engineer-home">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Today</div>
        <h1 className="font-display font-black text-2xl tracking-tight text-navy">Your shift</h1>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Assigned" value={stats.assigned} icon={Inbox} color="#8B5CF6" />
        <StatTile label="In Progress" value={stats.in_progress} icon={Wrench} color="#F97316" />
        <StatTile label="Completed" value={stats.completed} icon={CheckCircle2} color="#16A34A" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm uppercase tracking-wider text-slate-600">Active tickets</h2>
          <Link to="/engineer/tickets" className="text-xs font-bold text-signal">View all →</Link>
        </div>
        <div className="space-y-3">
          {active.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link to={`/engineer/tickets/${t.id}`}>
                <Card className={`p-4 rounded-md border-l-4 border-status-${t.status} hover-lift`}
                      data-testid={`engineer-ticket-card-${t.ticket_number}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-signal text-sm">{t.ticket_number}</span>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="font-semibold text-navy text-sm">{t.customer_name}</div>
                  <div className="text-xs text-slate-500 truncate">{t.device?.brand} {t.device?.model}</div>
                  <div className="text-xs text-slate-400 mt-2 flex items-center justify-between">
                    <span>{formatDate(t.created_at)}</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
          {active.length === 0 && (
            <Card className="p-8 text-center rounded-md">
              <div className="text-sm text-slate-500">No active tickets right now.</div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, icon: Icon, color }) {
  return (
    <Card className="p-3 rounded-md text-center">
      <div className="w-8 h-8 rounded-full grid place-items-center mx-auto mb-1" style={{ background: `${color}1a` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="font-display font-black text-2xl text-navy leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1 font-bold">{label}</div>
    </Card>
  );
}
