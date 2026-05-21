import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatError } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Clock, LogIn, LogOut } from "lucide-react";
import { formatDate } from "../../lib/status";

export default function EngineerAttendance() {
  const [today, setToday] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const [t, h] = await Promise.all([
        api.get("/attendance/today"),
        api.get("/attendance/history"),
      ]);
      setToday(t.data || null);
      setHistory(h.data || []);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const getLoc = () => new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(
      (p) => res({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => res(null),
      { timeout: 5000 }
    );
  });

  const checkIn = async () => {
    setLoading(true);
    try {
      const loc = await getLoc();
      await api.post("/attendance/check-in", loc || {});
      toast.success("Checked in for today");
      load();
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail));
    } finally { setLoading(false); }
  };

  const checkOut = async () => {
    setLoading(true);
    try {
      const loc = await getLoc();
      await api.post("/attendance/check-out", loc || {});
      toast.success("Checked out");
      load();
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail));
    } finally { setLoading(false); }
  };

  return (
    <div className="px-4 py-5 space-y-4" data-testid="engineer-attendance-page">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Today</div>
        <h1 className="font-display font-black text-2xl tracking-tight text-navy">Attendance</h1>
      </div>

      <Card className="p-5 rounded-md">
        <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-3">Today</div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded bg-slate-50 text-center">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Check In</div>
            <div className="font-mono font-bold text-navy mt-1">
              {today?.check_in ? new Date(today.check_in).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—"}
            </div>
          </div>
          <div className="p-3 rounded bg-slate-50 text-center">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Check Out</div>
            <div className="font-mono font-bold text-navy mt-1">
              {today?.check_out ? new Date(today.check_out).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—"}
            </div>
          </div>
        </div>
        {!today?.check_in ? (
          <Button onClick={checkIn} disabled={loading} className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 font-bold"
                  data-testid="check-in-btn">
            <LogIn className="w-4 h-4 mr-2" /> Check in
          </Button>
        ) : !today?.check_out ? (
          <Button onClick={checkOut} disabled={loading} className="w-full h-12 bg-orange-600 hover:bg-orange-700 font-bold"
                  data-testid="check-out-btn">
            <LogOut className="w-4 h-4 mr-2" /> Check out
          </Button>
        ) : (
          <div className="text-center text-sm text-slate-500 font-semibold">Day complete ✓</div>
        )}
      </Card>

      <Card className="p-5 rounded-md">
        <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-3 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Recent
        </div>
        <div className="space-y-2">
          {history.map((h) => (
            <div key={h.id} className="flex items-center justify-between p-2 rounded bg-slate-50">
              <div className="font-mono text-sm font-bold text-navy">{h.date}</div>
              <div className="text-xs text-slate-500 font-mono">
                {h.check_in ? h.check_in.split("T")[1].slice(0, 5) : "—"}
                {" → "}
                {h.check_out ? h.check_out.split("T")[1].slice(0, 5) : "—"}
              </div>
            </div>
          ))}
          {history.length === 0 && <div className="text-sm text-slate-500 text-center py-6">No attendance yet</div>}
        </div>
      </Card>
    </div>
  );
}
