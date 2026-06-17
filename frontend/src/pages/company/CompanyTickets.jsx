import React, { useMemo, useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getCachedJson, readCachedJson } from "../../lib/api";
import { useSmartPolling } from "../../hooks/useSmartPolling";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { StatusBadge, STATUS_LABEL, formatDate } from "../../lib/status";
import { Search, MapPin, AlertTriangle } from "lucide-react";

const CACHE_KEY = "company-tickets";

const STATUS_FILTERS = [
  { value: "all",         label: "All" },
  { value: "open",        label: "Open" },
  { value: "assigned",    label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved",    label: "Resolved" },
  { value: "closed",      label: "Closed" },
];

export default function CompanyTickets() {
  const [searchParams] = useSearchParams();
  const [tickets, setTickets] = useState(() => {
    const cached = readCachedJson(CACHE_KEY, 120000);
    return Array.isArray(cached) ? cached : cached?.items || [];
  });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");

  useEffect(() => {
    const s = searchParams.get("status");
    if (s) setStatusFilter(s);
  }, [searchParams]);

  const load = async () => {
    try {
      const data = await getCachedJson("/tickets", { ttl: 15000, storageKey: CACHE_KEY });
      setTickets(Array.isArray(data) ? data : data.items || []);
    } catch {}
  };

  useSmartPolling(load, 60000);

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (!search) return true;
      return [t.ticket_no, t.ticket_number, t.customer_name, t.company_name]
        .some((v) => v?.toLowerCase().includes(search));
    });
  }, [q, statusFilter, tickets]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">My Company</div>
        <h1 className="font-display font-black text-3xl tracking-tight text-navy mt-1">Tickets</h1>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tickets…"
          className="pl-9 h-11"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              statusFilter === f.value
                ? "bg-navy text-white border-navy"
                : "bg-white text-slate-600 border-slate-200 hover:border-navy"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card className="rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-[10px] uppercase tracking-[0.15em] text-slate-500">
                <th className="p-3 font-bold">Ticket</th>
                <th className="p-3 font-bold">Customer</th>
                <th className="p-3 font-bold">Address</th>
                <th className="p-3 font-bold">Engineer</th>
                <th className="p-3 font-bold">Status</th>
                <th className="p-3 font-bold">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3">
                    <Link to={`/company/tickets/${t.id}`} className="font-mono font-bold text-signal">
                      {t.ticket_no || t.ticket_number}
                    </Link>
                    {t.has_issue && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-[9px] font-bold uppercase px-1 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        <AlertTriangle className="w-2.5 h-2.5" /> Issue
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="font-semibold text-navy">{t.customer_name}</div>
                    <div className="text-xs text-slate-500">{t.customer_phone}</div>
                  </td>
                  <td className="p-3 min-w-[160px]">
                    <div className="text-xs text-slate-600 space-y-0.5">
                      {(t.current_address || t.company_address) && (
                        <div className="truncate max-w-[180px]">
                          {t.current_address || t.company_address}
                        </div>
                      )}
                      {(t.company_city || t.company_state) && (
                        <div className="flex items-center gap-1 text-slate-400">
                          <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                          <span>{[t.company_city, t.company_state, t.company_pincode].filter(Boolean).join(", ")}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-slate-700">{t.assigned_engineer_name || "—"}</td>
                  <td className="p-3"><StatusBadge status={t.status} /></td>
                  <td className="p-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(t.created_at)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500">No tickets found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
