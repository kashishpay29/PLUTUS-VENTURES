import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell
} from "recharts";
import { api } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { TrendingUp, AlertTriangle, Repeat } from "lucide-react";

const CHART_COLORS = ["#0A1128", "#2563EB", "#06B6D4", "#F59E0B", "#10B981", "#F97316", "#8B5CF6", "#EF4444"];

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get("/analytics").then(({ data }) => setData(data)).catch(() => {});
  }, []);

  if (!data) return <div className="text-slate-500">Loading…</div>;

  return (
    <div className="space-y-6" data-testid="analytics-page">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Insights</div>
        <h1 className="font-display font-black text-3xl tracking-tight text-navy">Analytics</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 rounded-md">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-navy" />
            <div className="font-bold">Daily ticket volume</div>
          </div>
          <div className="text-xs text-slate-500 mb-4">Last 14 days</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.per_day}>
              <CartesianGrid stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748B" }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: "#64748B" }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 rounded-md">
          <div className="font-bold mb-1">Engineer performance</div>
          <div className="text-xs text-slate-500 mb-4">Completed vs Active tickets</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.engineer_performance}>
              <CartesianGrid stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} />
              <YAxis tick={{ fontSize: 10, fill: "#64748B" }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="completed" fill="#16A34A" radius={[4, 4, 0, 0]} />
              <Bar dataKey="active" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 rounded-md">
          <div className="font-bold mb-1">Brand failure trend</div>
          <div className="text-xs text-slate-500 mb-4">Tickets by device brand</div>
          {data.brand_trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={data.brand_trend} dataKey="tickets" nameKey="brand"
                      cx="50%" cy="50%" outerRadius={90} label={(e) => e.brand}>
                  {data.brand_trend.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-sm text-slate-500">No data yet</div>
          )}
        </Card>

        <Card className="p-6 rounded-md">
          <div className="flex items-center gap-2 mb-1">
            <Repeat className="w-4 h-4 text-navy" />
            <div className="font-bold">Repeat complaints</div>
          </div>
          <div className="text-xs text-slate-500 mb-4">Devices with multiple visits</div>
          <div className="space-y-2 max-h-[240px] overflow-auto">
            {data.repeat_complaints.map((r) => (
              <div key={r.device_id} className="flex items-center justify-between p-2 rounded bg-slate-50">
                <div>
                  <div className="font-mono text-xs font-bold text-signal">{r.device_id}</div>
                  <div className="text-sm">{r.brand} {r.model}</div>
                </div>
                <div className="font-display font-black text-2xl text-navy">{r.count}<span className="text-xs text-slate-500 ml-1">visits</span></div>
              </div>
            ))}
            {data.repeat_complaints.length === 0 && (
              <div className="text-sm text-slate-500 text-center py-8">No repeat complaints yet</div>
            )}
          </div>
        </Card>
      </div>

      {data.warranty_alerts.length > 0 && (
        <Card className="p-6 rounded-md border-l-4 border-amber-400 bg-amber-50/30">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <div className="font-bold text-navy">Warranty expiring within 30 days</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.warranty_alerts.map((d) => (
              <div key={d.device_id} className="p-3 rounded bg-white border border-amber-100">
                <div className="font-mono text-xs font-bold text-amber-800">{d.device_id}</div>
                <div className="font-semibold text-navy">{d.brand} {d.model}</div>
                <div className="text-xs text-slate-500">Expires {d.warranty_expiry}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
