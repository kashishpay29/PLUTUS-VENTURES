import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { StatusBadge, STATUS_LABEL, formatDate } from "../../lib/status";
import { Search, PlusCircle, LayoutGrid, List as ListIcon } from "lucide-react";

const COLUMNS = [
  "open", "assigned", "accepted", "travelling",
  "reached_site", "in_progress", "resolved",
  "completed_with_signature", "report_generated", "closed",
];

export default function TicketBoard() {
  const [tickets, setTickets] = useState([]);
  const [q, setQ] = useState("");
  const [view, setView] = useState("board");

  const load = async () => {
    try {
      const { data } = await api.get("/tickets");
      setTickets(data);
    } catch {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const filtered = tickets.filter((t) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      t.ticket_number?.toLowerCase().includes(s) ||
      t.customer_name?.toLowerCase().includes(s) ||
      t.device?.device_id?.toLowerCase().includes(s) ||
      t.engineer?.name?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6" data-testid="admin-tickets-page">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Tickets</div>
          <h1 className="font-display font-black text-3xl tracking-tight text-navy">Live ticket board</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-md p-1">
            <button
              onClick={() => setView("board")}
              className={`px-3 py-1.5 rounded text-xs font-bold inline-flex items-center gap-1.5 ${view === "board" ? "bg-white shadow-sm" : "text-slate-500"}`}
              data-testid="view-board-btn"
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Board
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-3 py-1.5 rounded text-xs font-bold inline-flex items-center gap-1.5 ${view === "list" ? "bg-white shadow-sm" : "text-slate-500"}`}
              data-testid="view-list-btn"
            >
              <ListIcon className="w-3.5 h-3.5" /> List
            </button>
          </div>
          <Link to="/admin/tickets/new">
            <Button className="bg-navy hover:bg-navy/90 text-white font-semibold rounded-md">
              <PlusCircle className="w-4 h-4 mr-2" /> New Ticket
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by ticket #, customer, device, engineer…"
          className="pl-9 h-11"
          data-testid="ticket-search-input"
        />
      </div>

      {view === "board" && (
        <div className="overflow-x-auto kanban-scroll -mx-4 px-4 pb-2" data-testid="ticket-kanban-board">
          <div className="flex gap-4 min-w-max">
            {COLUMNS.map((col) => {
              const items = filtered.filter((t) => t.status === col);
              return (
                <div key={col} className="kanban-col w-80 flex-shrink-0">
                  <div className={`mb-3 flex items-center justify-between border-l-4 pl-2 border-status-${col}`}>
                    <div className="text-xs uppercase tracking-[0.18em] font-bold text-navy">
                      {STATUS_LABEL[col]}
                    </div>
                    <span className="font-mono font-bold text-sm text-slate-500">{items.length}</span>
                  </div>
                  <div className="space-y-3 min-h-[200px]">
                    {items.map((t, idx) => (
                      <motion.div
                        key={t.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                      >
                        <Link to={`/admin/tickets/${t.id}`}>
                          <Card className={`p-4 hover-lift rounded-md border-l-4 border-status-${t.status}`}
                                data-testid={`ticket-card-${t.ticket_number}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-mono font-bold text-xs text-signal">{t.ticket_number}</div>
                              {t.device?.warranty_status === "active" && (
                                <span className="text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                                  Warranty
                                </span>
                              )}
                            </div>
                            <div className="font-semibold text-navy text-sm truncate">{t.customer_name}</div>
                            <div className="text-xs text-slate-500 truncate">
                              {t.device?.brand} {t.device?.model}
                            </div>
                            <div className="mt-3 flex items-center justify-between">
                              {t.engineer ? (
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 rounded-full bg-navy text-white grid place-items-center text-[10px] font-bold">
                                    {t.engineer.name?.[0]?.toUpperCase()}
                                  </div>
                                  <span className="text-xs text-slate-600 truncate max-w-[100px]">{t.engineer.name}</span>
                                </div>
                              ) : (
                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Unassigned</span>
                              )}
                              <div className="text-[10px] text-slate-400 font-mono">{formatDate(t.created_at).split(",")[0]}</div>
                            </div>
                          </Card>
                        </Link>
                      </motion.div>
                    ))}
                    {items.length === 0 && (
                      <div className="text-center py-8 text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-md">
                        No tickets
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "list" && (
        <Card className="rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-[10px] uppercase tracking-[0.15em] text-slate-500">
                <th className="p-3 font-bold">Ticket</th>
                <th className="p-3 font-bold">Customer</th>
                <th className="p-3 font-bold">Device</th>
                <th className="p-3 font-bold">Engineer</th>
                <th className="p-3 font-bold">Status</th>
                <th className="p-3 font-bold">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3">
                    <Link to={`/admin/tickets/${t.id}`}
                          className="font-mono font-bold text-signal">
                      {t.ticket_number}
                    </Link>
                  </td>
                  <td className="p-3">
                    <div className="font-semibold text-navy">{t.customer_name}</div>
                    <div className="text-xs text-slate-500">{t.customer_company || t.customer_phone}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{t.device?.brand} {t.device?.model}</div>
                    <div className="text-xs font-mono text-slate-500">{t.device?.device_id}</div>
                  </td>
                  <td className="p-3 text-slate-700">{t.engineer?.name || "—"}</td>
                  <td className="p-3"><StatusBadge status={t.status} /></td>
                  <td className="p-3 text-xs text-slate-500">{formatDate(t.created_at)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500">No tickets found</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
