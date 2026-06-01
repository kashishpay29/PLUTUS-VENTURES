import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api, getCachedJson, readCachedJson } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useSmartPolling } from "../../hooks/useSmartPolling";
import { Card } from "../../components/ui/card";
import { Switch } from "../../components/ui/switch";
import { Inbox, Wrench, CheckCircle2, ChevronRight, Wifi, WifiOff } from "lucide-react";
import { StatusBadge, formatDate } from "../../lib/status";
import { toast } from "sonner";

const ENGINEER_DASHBOARD_CACHE_KEY = "engineer-dashboard";

export default function EngineerHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState(() => readCachedJson(ENGINEER_DASHBOARD_CACHE_KEY));
  const [isRemote, setIsRemote] = useState(() => {
    const cached = readCachedJson(ENGINEER_DASHBOARD_CACHE_KEY);
    return Boolean(cached?.is_remote);
  });

  const load = async () => {
    try {
      const data = await getCachedJson("/dashboard/engineer", {
        ttl: 15000,
        storageKey: ENGINEER_DASHBOARD_CACHE_KEY,
      });
      setStats(data);
      setIsRemote(data.is_remote || false);
    } catch {}
  };

  useSmartPolling(load, 60000);

  const toggleRemote = async (val) => {
    try {
      setIsRemote(val);
      await api.patch(`/engineers/${user.id}`, { is_remote: val });
      setStats((prev) => (prev ? { ...prev, is_remote: val } : prev));
      toast.success(val ? "Switched to remote work" : "Switched to on-site work");
    } catch {
      setIsRemote(!val);
      toast.error("Failed to update work mode");
    }
  };

  if (!stats) return <div className="p-4 text-slate-500">Loading…</div>;

  const active = stats.active_tickets || [];

  return (
    <div className="px-4 py-5 space-y-5" data-testid="engineer-home">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Today</div>
        <h1 className="font-display font-black text-2xl tracking-tight text-navy">Your shift</h1>
      </div>

      {/* Remote toggle */}
      <Card className={`p-4 rounded-md border-2 ${isRemote ? "border-blue-200 bg-blue-50" : "border-slate-100 bg-slate-50"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full grid place-items-center ${isRemote ? "bg-blue-100" : "bg-slate-200"}`}>
              {isRemote
                ? <Wifi className="w-5 h-5 text-blue-600" />
                : <WifiOff className="w-5 h-5 text-slate-500" />
              }
            </div>
            <div>
              <div className={`font-bold text-sm ${isRemote ? "text-blue-700" : "text-slate-700"}`}>
                {isRemote ? "Working Remotely" : "Working On-Site"}
              </div>
              <div className="text-xs text-slate-500">
                {isRemote ? "You are marked as remote" : "Toggle if you are not travelling today"}
              </div>
            </div>
          </div>
          <Switch checked={isRemote} onCheckedChange={toggleRemote} />
        </div>
      </Card>

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
          {active.map((t) => (
            <div key={t.id}>
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
            </div>
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
