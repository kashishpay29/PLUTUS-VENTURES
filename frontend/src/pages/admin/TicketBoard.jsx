import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getCachedJson, readCachedJson } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useSmartPolling } from "../../hooks/useSmartPolling";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { StatusBadge, STATUS_LABEL, formatDate } from "../../lib/status";
import { Search, PlusCircle, LayoutGrid, List as ListIcon , Wifi } from "lucide-react";

const COLUMNS = [
  "open", "assigned", "accepted", "travelling",
  "reached_site", "in_progress", "resolved",
  "completed_with_signature", "report_generated", "closed",
];

const STATUS_FILTERS = [
  { value: "all",         label: "All" },
  { value: "open",        label: "Open" },
  { value: "assigned",    label: "Assigned" },
  { value: "accepted",    label: "Accepted" },
  { value: "travelling",  label: "Travelling" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved",    label: "Resolved" },
  { value: "closed",      label: "Closed" },
];

const TICKETS_CACHE_KEY = "admin-tickets";

export default function TicketBoard() {
  const { user } = useAuth();
  const isTicketAdmin = user?.role === "ticket_admin";
  const [tickets, setTickets] = useState(() => {
    const cached = readCachedJson(TICKETS_CACHE_KEY, 120000);
    return Array.isArray(cached) ? cached : cached?.items || [];
  });
  const [q, setQ] = useState("");
  const [view, setView] = useState("board");
  const [statusFilter, setStatusFilter] = useState("all");
  const visibleColumns = useMemo(
    () => (isTicketAdmin ? COLUMNS.filter((col) => col !== "closed") : COLUMNS),
    [isTicketAdmin]
  );
  const visibleStatusFilters = useMemo(
    () => (isTicketAdmin ? STATUS_FILTERS.filter((f) => f.value !== "closed") : STATUS_FILTERS),
    [isTicketAdmin]
  );

  const load = async () => {
    try {
      const data = await getCachedJson("/tickets", {
        ttl: 15000,
        storageKey: TICKETS_CACHE_KEY,
      });
      setTickets(Array.isArray(data) ? data : data.items || []);
    } catch {}
  };

  useSmartPolling(load, 60000);

  const statusCounts = useMemo(() => {
    return tickets.reduce((acc, ticket) => {
      acc[ticket.status] = (acc[ticket.status] || 0) + 1;
      return acc;
    }, {});
  }, [tickets]);

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (statusFilter !== "all" && ticket.status !== statusFilter) return false;
      if (!search) return true;

      return [
        ticket.ticket_no,
        ticket.ticket_number,
        ticket.customer_name,
        ticket.device?.device_id,
        ...(ticket.devices || []).flatMap((device) => [
          device.device_id,
          device.serial_number,
          device.brand,
          device.model,
        ]),
        ticket.engineer?.name,
        ticket.company_name,
        ticket.customer_company,
        ticket.company?.name,
      ].some((value) => value?.toLowerCase().includes(search));
    });
  }, [q, statusFilter, tickets]);

  const ticketsByColumn = useMemo(() => {
    const grouped = Object.fromEntries(visibleColumns.map((col) => [col, []]));
    filtered.forEach((ticket) => {
      if (grouped[ticket.status]) grouped[ticket.status].push(ticket);
    });
    return grouped;
  }, [filtered, visibleColumns]);

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
          placeholder="Search by ticket #, customer, company, device, engineer…"
          className="pl-9 h-11"
          data-testid="ticket-search-input"
        />
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {visibleStatusFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              statusFilter === f.value
                ? "bg-navy text-white border-navy"
                : "bg-white text-slate-600 border-slate-200 hover:border-navy hover:text-navy"
            }`}
          >
            {f.label}
            {f.value !== "all" && (
              <span className="ml-1.5 opacity-60">
                {statusCounts[f.value] || 0}
              </span>
            )}
          </button>
        ))}
        {statusFilter !== "all" && (
          <button onClick={() => setStatusFilter("all")}
            className="px-3 py-1.5 rounded-full text-xs font-bold text-slate-400 hover:text-red-500">
            ✕ Clear
          </button>
        )}
      </div>

      {view === "board" && (
        <div className="overflow-x-auto kanban-scroll -mx-4 px-4 pb-2" data-testid="ticket-kanban-board">
          <div className="flex gap-4 min-w-max">
            {visibleColumns.map((col) => {
              const items = ticketsByColumn[col];
              return (
                <div key={col} className="kanban-col w-80 flex-shrink-0">
                  <div className={`mb-3 flex items-center justify-between border-l-4 pl-2 border-status-${col}`}>
                    <div className="text-xs uppercase tracking-[0.18em] font-bold text-navy">
                      {STATUS_LABEL[col]}
                    </div>
                    <span className="font-mono font-bold text-sm text-slate-500">{items.length}</span>
                  </div>
                  <div className="space-y-3 min-h-[200px]">
                    {items.map((t) => (
                      <div
                        key={t.id}
                      >
                        <Link to={`/admin/tickets/${t.id}`}>
                          <Card className={`p-4 hover-lift rounded-md border-l-4 border-status-${t.status}`}
                                data-testid={`ticket-card-${t.ticket_number}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-mono font-bold text-xs text-signal">{t.ticket_number}</div>
                              {hasActiveWarranty(t) && (
                                <span className="text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                                  Warranty
                                </span>
                              )}
                            </div>
                            <div className="font-semibold text-navy text-sm truncate">{t.customer_name}</div>
                            <div className="text-xs text-slate-500 truncate">
                              {deviceSummary(t)}
                            </div>
                            <div className="mt-3 flex items-center justify-between">
                              {t.engineer ? (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <div className="w-5 h-5 rounded-full bg-navy text-white grid place-items-center text-[10px] font-bold">
                                    {t.engineer.name?.[0]?.toUpperCase()}
                                  </div>
                                  <span className="text-xs text-slate-600 truncate max-w-[100px]">{t.engineer.name}</span>
                                  {t.engineer.is_remote && (
                                    <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase px-1 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                      <Wifi className="w-2 h-2" /> Remote
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Unassigned</span>
                              )}
                              <div className="text-[10px] text-slate-400 font-mono">{formatDate(t.created_at).split(",")[0]}</div>
                            </div>
                          </Card>
                        </Link>
                      </div>
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
                <th className="p-3 font-bold">Created by</th>
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
                    <div className="font-medium">{deviceSummary(t)}</div>
                    <div className="text-xs font-mono text-slate-500">{deviceIdSummary(t)}</div>
                  </td>
                  <td className="p-3 text-slate-700">{t.engineer?.name || "—"}</td>
                  <td className="p-3">
                    {t.created_by_user ? (
                      <div>
                        <div className="text-sm font-semibold text-navy">{t.created_by_user.name}</div>
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full ${
                          t.created_by_user.role === "admin" ? "bg-navy/10 text-navy" : "bg-purple-100 text-purple-700"
                        }`}>{creatorRoleLabel(t.created_by_user.role)}</span>
                      </div>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="p-3"><StatusBadge status={t.status} /></td>
                  <td className="p-3 text-xs text-slate-500">{formatDate(t.created_at)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-slate-500">No tickets found</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function ticketDevices(ticket) {
  return ticket.devices?.length ? ticket.devices : (ticket.device ? [ticket.device] : []);
}

function deviceSummary(ticket) {
  const devices = ticketDevices(ticket);
  const first = devices[0];
  if (!first) return "—";
  const primary = `${first.brand || ""} ${first.model || ""}`.trim() || first.device_id || "Device";
  return devices.length > 1 ? `${primary} +${devices.length - 1} more` : primary;
}

function deviceIdSummary(ticket) {
  const devices = ticketDevices(ticket);
  if (!devices.length) return "—";
  const ids = devices.map((device) => device.device_id).filter(Boolean);
  return ids.join(", ") || "—";
}

function hasActiveWarranty(ticket) {
  return ticketDevices(ticket).some((device) => device.warranty_status === "active");
}

function creatorRoleLabel(role) {
  if (role === "sub_admin") return "Sub Admin";
  if (role === "ticket_admin") return "Ticket Admin";
  return "Admin";
}
