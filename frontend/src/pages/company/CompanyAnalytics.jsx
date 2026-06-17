import React, { useState } from "react";
import { getCachedJson, readCachedJson } from "../../lib/api";
import { useSmartPolling } from "../../hooks/useSmartPolling";
import { Card } from "../../components/ui/card";

const CACHE_KEY = "company-analytics";

export default function CompanyAnalytics() {
  const [data, setData] = useState(() => readCachedJson(CACHE_KEY));

  const load = async () => {
    try {
      const fresh = await getCachedJson("/analytics/company", {
        ttl: 120000,
        storageKey: CACHE_KEY,
      });
      setData(fresh);
    } catch {}
  };

  useSmartPolling(load, 120000);

  if (!data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/4" />
        <div className="grid grid-cols-2 gap-4">
          {[1,2,3,4].map((i) => <div key={i} className="h-32 bg-slate-200 rounded" />)}
        </div>
      </div>
    );
  }

  const statusCounts = data.status_counts ?? {};
  const perDay = data.per_day ?? [];

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Insights</div>
        <h1 className="font-display font-black text-3xl tracking-tight text-navy mt-1">Analytics</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-md">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">Avg Resolution</div>
          <div className="mt-2 font-display font-black text-3xl text-navy">{data.avg_resolution_hours ?? 0}h</div>
          <div className="text-xs text-slate-500 mt-1">per ticket</div>
        </Card>
        <Card className="p-5 rounded-md">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">Total Closed</div>
          <div className="mt-2 font-display font-black text-3xl text-navy">{data.total_closed ?? 0}</div>
          <div className="text-xs text-slate-500 mt-1">tickets resolved</div>
        </Card>
        <Card className="p-5 rounded-md">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">Open</div>
          <div className="mt-2 font-display font-black text-3xl text-navy">{statusCounts.open ?? 0}</div>
          <div className="text-xs text-slate-500 mt-1">pending</div>
        </Card>
        <Card className="p-5 rounded-md">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">In Progress</div>
          <div className="mt-2 font-display font-black text-3xl text-navy">
            {(statusCounts.assigned ?? 0) + (statusCounts.in_progress ?? 0)}
          </div>
          <div className="text-xs text-slate-500 mt-1">being worked on</div>
        </Card>
      </div>

      <Card className="p-6 rounded-md">
        <div className="font-bold mb-4">Tickets — Last 14 Days</div>
        <div className="flex items-end gap-1 h-32">
          {perDay.map((d) => {
            const max = Math.max(...perDay.map((x) => x.count), 1);
            const pct = (d.count / max) * 100;
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-navy/80 rounded-t"
                  style={{ height: `${Math.max(pct, 4)}%` }}
                  title={`${d.date}: ${d.count}`}
                />
                <div className="text-[8px] text-slate-400 rotate-45 origin-left whitespace-nowrap">
                  {d.date.slice(5)}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-6 rounded-md">
        <div className="font-bold mb-4">Tickets by Status</div>
        <div className="space-y-2">
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} className="flex items-center gap-3">
              <div className="w-28 text-xs text-slate-600 capitalize">{status.replace(/_/g, " ")}</div>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-navy rounded-full"
                  style={{ width: `${(count / Math.max(...Object.values(statusCounts), 1)) * 100}%` }}
                />
              </div>
              <div className="w-8 text-right text-xs font-mono font-bold text-navy">{count}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
