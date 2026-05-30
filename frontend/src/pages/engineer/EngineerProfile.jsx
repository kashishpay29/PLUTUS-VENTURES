import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Card } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { formatDate, StatusBadge } from "../../lib/status";
import { Mail, Phone, Award, Pencil, Wifi, X, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function EngineerProfile() {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [profile, setProfile] = useState(null);
  const [editingOem, setEditingOem] = useState(false);
  const [oemValue, setOemValue] = useState("");

  useEffect(() => {
    api.get("/tickets").then(({ data }) => {
      const tickets = Array.isArray(data) ? data : data.items || [];
      setHistory(tickets.filter((t) => t.status === "completed").slice(0, 20));
    }).catch(() => {});

    api.get("/auth/me").then(({ data }) => {
      setProfile(data);
      setOemValue(data.oem_number || "");
    }).catch(() => {});
  }, []);

  if (!user || user === false) return null;

  const saveOem = async () => {
    try {
      await api.patch(`/engineers/${user.id}`, { oem_number: oemValue || null });
      setProfile((p) => ({ ...p, oem_number: oemValue || null }));
      setEditingOem(false);
      toast.success("OEM number saved");
    } catch {
      toast.error("Failed to save OEM number");
    }
  };

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
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-display font-bold text-lg text-navy">{user.name}</div>
              {profile?.is_remote && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  <Wifi className="w-3 h-3" /> Remote
                </span>
              )}
            </div>
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

        {/* OEM Number
        <div className="mt-4 p-3 rounded-md bg-slate-50 border border-slate-200">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">OEM Number</div>
            {!editingOem && (
              <button onClick={() => setEditingOem(true)}
                className="p-1 rounded hover:bg-slate-200">
                <Pencil className="w-3.5 h-3.5 text-slate-500" />
              </button>
            )}
          </div>
          {editingOem ? (
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={oemValue}
                onChange={(e) => setOemValue(e.target.value)}
                placeholder="e.g. OEM-12345 (optional)"
                className="h-8 text-sm"
                autoFocus
              />
              <button onClick={saveOem} className="p-1.5 rounded bg-green-100 hover:bg-green-200">
                <Check className="w-4 h-4 text-green-700" />
              </button>
              <button onClick={() => { setEditingOem(false); setOemValue(profile?.oem_number || ""); }}
                className="p-1.5 rounded bg-slate-100 hover:bg-slate-200">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          ) : (
            <div className="text-sm font-mono text-navy mt-0.5">
              {profile?.oem_number || <span className="text-slate-400 font-sans font-normal text-xs">Not set — tap pencil to add</span>}
            </div>
          )}
        </div> */}

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