import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell
} from "recharts";
import { api } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { TrendingUp, AlertTriangle, Repeat, Users, ChevronLeft, ChevronRight, Clock, Award, Timer } from "lucide-react";

const CHART_COLORS = ["#0A1128", "#2563EB", "#06B6D4", "#F59E0B", "#10B981", "#F97316", "#8B5CF6", "#EF4444"];

function getMonthLabel(ym) {
  const [y, m] = ym.split("-");
  return new Date(y, m - 1).toLocaleString("default", { month: "long", year: "numeric" });
}

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  useEffect(() => {
    api.get("/analytics").then(({ data }) => {
      setData(data);
      // Default to current month
      const now = new Date();
      setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    }).catch(() => {});
  }, []);

  if (!data) return <div className="text-slate-500">Loading…</div>;

  const months = Object.keys(data.customer_by_month || {}).sort().reverse();
  const currentMonthIdx = months.indexOf(selectedMonth);
  const customersThisMonth = (data.customer_by_month?.[selectedMonth] || [])
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6" data-testid="analytics-page">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Insights</div>
        <h1 className="font-display font-black text-3xl tracking-tight text-navy">Analytics</h1>
      </div>

      {/* Customer Analytics */}
      <Card className="p-6 rounded-md">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-navy" />
              <div className="font-bold text-navy">Customer ticket activity</div>
            </div>
            <div className="text-xs text-slate-500">Tickets raised per customer by month</div>
          </div>
          {/* Month navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedMonth(months[currentMonthIdx + 1])}
              disabled={currentMonthIdx >= months.length - 1}
              className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-sm font-bold text-navy min-w-[140px] text-center">
              {selectedMonth ? getMonthLabel(selectedMonth) : "—"}
            </div>
            <button
              onClick={() => setSelectedMonth(months[currentMonthIdx - 1])}
              disabled={currentMonthIdx <= 0}
              className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {customersThisMonth.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-500">No tickets raised this month</div>
        ) : (
          <>
            {/* Bar chart */}
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={customersThisMonth.slice(0, 10)}
                        margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                <CartesianGrid stroke="#F1F5F9" />
                <XAxis dataKey="customer" tick={{ fontSize: 10, fill: "#64748B" }}
                       angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: "#64748B" }} allowDecimals={false} />
                <Tooltip
                  formatter={(val, _, props) => [
                    `${val} ticket${val > 1 ? "s" : ""}`,
                    props.payload.company || props.payload.customer
                  ]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {customersThisMonth.slice(0, 10).map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Table list */}
            <div className="mt-4 space-y-2 max-h-64 overflow-auto">
              {customersThisMonth.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-md bg-slate-50 hover:bg-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-navy text-white grid place-items-center text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-navy text-sm">{c.customer}</div>
                      {c.company && <div className="text-xs text-slate-500">{c.company}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-display font-black text-2xl text-navy">{c.count}</span>
                    <span className="text-xs text-slate-500">ticket{c.count > 1 ? "s" : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Resolution Time */}
      {data.resolution_time && (
        <Card className="p-6 rounded-md">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-navy" />
            <div className="font-bold text-navy">Ticket resolution time</div>
          </div>
          <div className="text-xs text-slate-500 mb-5">How long it takes to close a ticket</div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-3 rounded-md bg-blue-50 text-center">
              <div className="text-xs text-slate-500 mb-1">Average</div>
              <div className="font-display font-black text-2xl text-navy">
                {data.resolution_time.avg_hours < 24
                  ? `${data.resolution_time.avg_hours}h`
                  : `${(data.resolution_time.avg_hours / 24).toFixed(1)}d`}
              </div>
            </div>
            <div className="p-3 rounded-md bg-green-50 text-center">
              <div className="text-xs text-slate-500 mb-1">Fastest</div>
              <div className="font-display font-black text-2xl text-green-700">
                {data.resolution_time.min_hours < 24
                  ? `${data.resolution_time.min_hours}h`
                  : `${(data.resolution_time.min_hours / 24).toFixed(1)}d`}
              </div>
            </div>
            <div className="p-3 rounded-md bg-red-50 text-center">
              <div className="text-xs text-slate-500 mb-1">Slowest</div>
              <div className="font-display font-black text-2xl text-red-600">
                {data.resolution_time.max_hours < 24
                  ? `${data.resolution_time.max_hours}h`
                  : `${(data.resolution_time.max_hours / 24).toFixed(1)}d`}
              </div>
            </div>
          </div>

          {/* Bucket bar chart */}
          <div className="mb-1 text-xs font-bold text-slate-500 uppercase tracking-wider">Distribution</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.resolution_time.buckets}
                      margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
              <CartesianGrid stroke="#F1F5F9" />
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: "#64748B" }} angle={-20} textAnchor="end" />
              <YAxis tick={{ fontSize: 10, fill: "#64748B" }} allowDecimals={false} />
              <Tooltip formatter={(v) => [`${v} tickets`, "Count"]} />
              <Bar dataKey="count" radius={[4,4,0,0]}>
                {data.resolution_time.buckets.map((_, i) => (
                  <Cell key={i} fill={["#16A34A","#22C55E","#F59E0B","#F97316","#EF4444","#991B1B"][i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Per engineer resolution */}
          {data.resolution_time.by_engineer.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">By engineer</div>
              <div className="space-y-2">
                {data.resolution_time.by_engineer.map((e, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-24 text-xs font-semibold text-navy truncate">{e.name}</div>
                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                      <div className="bg-navy h-2 rounded-full"
                           style={{ width: `${Math.min(100, (e.avg_hours / (data.resolution_time.max_hours || 1)) * 100)}%` }} />
                    </div>
                    <div className="text-xs font-bold text-slate-600 w-16 text-right">
                      {e.avg_hours < 24 ? `${e.avg_hours}h` : `${(e.avg_hours/24).toFixed(1)}d`}
                      <span className="text-slate-400 font-normal ml-1">({e.tickets})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.resolution_time.total_closed === 0 && (
            <div className="text-center py-8 text-sm text-slate-400">No closed tickets yet</div>
          )}
        </Card>
      )}

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