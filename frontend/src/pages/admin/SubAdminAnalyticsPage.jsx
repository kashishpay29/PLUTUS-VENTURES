import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { api } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function SubAdminAnalyticsPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/sub-admins/${id}/analytics`)
      .then(({ data }) => setData(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-slate-500">Loading…</div>;
  if (!data) return <div className="p-8 text-slate-500">Not found</div>;

  const counts = data.ticket_counts || {};

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/sub-admins" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-navy mb-3">
          <ArrowLeft className="w-3 h-3" /> Back to Sub-Admins
        </Link>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Analytics</div>
        <h1 className="font-display font-black text-3xl tracking-tight text-navy">{data.sub_admin.name}</h1>
        <p className="text-slate-500 text-sm">{data.sub_admin.email}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {["open", "in_progress", "completed", "total"].map((k) => (
          <Card key={k} className="p-5 rounded-md">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">{k.replace("_", " ")}</div>
            <div className="font-display font-black text-4xl text-navy mt-2">{counts[k] || 0}</div>
          </Card>
        ))}
      </div>

      <Card className="p-6 rounded-md">
        <div className="font-bold mb-4">Tickets — Last 14 days</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.per_day || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#2563EB" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-6 rounded-md">
        <div className="font-bold mb-4">Engineer Performance</div>
        {data.engineer_performance?.length === 0 && (
          <div className="text-sm text-slate-500">No data yet</div>
        )}
        <div className="space-y-3">
          {(data.engineer_performance || []).map((e) => (
            <div key={e.name} className="flex items-center justify-between p-3 rounded-md bg-slate-50">
              <div className="font-semibold text-navy">{e.name}</div>
              <div className="flex gap-4 text-sm">
                <span className="text-emerald-600 font-bold">{e.completed} completed</span>
                <span className="text-blue-600 font-bold">{e.active} active</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}