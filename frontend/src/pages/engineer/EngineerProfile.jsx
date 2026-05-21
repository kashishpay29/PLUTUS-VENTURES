import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Card } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { formatDate, StatusBadge } from "../../lib/status";
import { Mail, Phone, Award } from "lucide-react";
import { Link } from "react-router-dom";

export default function EngineerProfile() {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);

  useEffect(() => {
    api.get("/tickets").then(({ data }) => {
      setHistory(data.filter((t) => t.status === "completed").slice(0, 20));
    }).catch(() => {});
  }, []);

  if (!user || user === false) return null;

  return (
    <div className="px-4 py-5 space-y-4" data-testid="engineer-profile-page">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Account</div>
        <h1 className="font-display font-black text-2xl tracking-tight text-navy">Profile</h1>
      </div>

      <Card className="p-5 rounded-md">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-navy text-white grid place-items-center font-black text-2xl">
            {user.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="font-display font-bold text-lg text-navy">{user.name}</div>
            <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
              <Mail className="w-3 h-3" /> {user.email}
            </div>
            {user.phone && (
              <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3" /> {user.phone}
              </div>
            )}
          </div>
        </div>
        {user.skills?.length > 0 && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1 mb-2">
              <Award className="w-3 h-3" /> Skills
            </div>
            <div className="flex flex-wrap gap-1">
              {user.skills.map((s) => (
                <Badge key={s} variant="secondary" className="font-bold">{s}</Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5 rounded-md">
        <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3">
          Completed tickets ({history.length})
        </div>
        <div className="space-y-2">
          {history.map((t) => (
            <Link to={`/engineer/tickets/${t.id}`} key={t.id}>
              <div className="p-3 rounded bg-slate-50 hover:bg-slate-100 flex items-center justify-between">
                <div>
                  <div className="font-mono font-bold text-signal text-xs">{t.ticket_number}</div>
                  <div className="text-sm font-semibold text-navy">{t.customer_name}</div>
                  <div className="text-xs text-slate-500">{formatDate(t.updated_at)}</div>
                </div>
                <StatusBadge status={t.status} />
              </div>
            </Link>
          ))}
          {history.length === 0 && <div className="text-sm text-slate-500 text-center py-6">No completed tickets yet</div>}
        </div>
      </Card>
    </div>
  );
}
