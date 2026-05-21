import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { StatusBadge } from "../../lib/status";
import LiveMap from "../../components/LiveMap";
import { MapPin } from "lucide-react";

export default function LivePage() {
  const [list, setList] = useState([]);

  const load = async () => {
    try {
      const { data } = await api.get("/live-locations");
      setList(data);
    } catch {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  const markers = list.map((l) => ({
    lat: l.location?.lat,
    lng: l.location?.lng,
    label: l.engineer_name,
    subtitle: `${l.ticket_number} • ${l.customer_name}`,
  }));

  return (
    <div className="space-y-6" data-testid="live-page">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Field operations</div>
          <h1 className="font-display font-black text-3xl tracking-tight text-navy">Live engineer map</h1>
          <p className="text-slate-500 text-sm mt-1 flex items-center gap-2">
            <span className="pulse-dot" /> {list.length} engineers in the field
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="rounded-md overflow-hidden lg:col-span-2 h-[500px]">
          <LiveMap markers={markers} />
        </Card>
        <Card className="rounded-md p-4 max-h-[500px] overflow-auto">
          <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3">
            Currently dispatched
          </div>
          <div className="space-y-3">
            {list.map((l) => (
              <div key={l.ticket_id} className="p-3 rounded border-l-4 border-status-travelling bg-slate-50">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-signal text-sm">{l.ticket_number}</span>
                  <StatusBadge status={l.status} />
                </div>
                <div className="text-sm font-semibold text-navy">{l.engineer_name}</div>
                <div className="text-xs text-slate-500">→ {l.customer_name}</div>
                <div className="text-[10px] font-mono text-slate-400 mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {l.location?.lat?.toFixed(4)}, {l.location?.lng?.toFixed(4)}
                </div>
              </div>
            ))}
            {list.length === 0 && (
              <div className="text-sm text-slate-500 text-center py-12">No engineers in the field right now</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
