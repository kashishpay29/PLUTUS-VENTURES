import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { StatusBadge, formatDate } from "../../lib/status";
import { ChevronRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";

export default function EngineerTickets() {
  const [tickets, setTickets] = useState([]);

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

  const groups = {
    active: tickets.filter((t) => ["assigned", "accepted", "travelling", "reached_site", "in_progress"].includes(t.status)),
    resolved: tickets.filter((t) => ["resolved", "completed_with_signature"].includes(t.status)),
    completed: tickets.filter((t) => ["closed", "report_generated", "completed"].includes(t.status)),
  };

  return (
    <div className="px-4 py-5 space-y-4" data-testid="engineer-tickets-page">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">My work</div>
        <h1 className="font-display font-black text-2xl tracking-tight text-navy">Tickets</h1>
      </div>

      <Tabs defaultValue="active">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="active" data-testid="tab-active">Active ({groups.active.length})</TabsTrigger>
          <TabsTrigger value="resolved" data-testid="tab-resolved">Resolved ({groups.resolved.length})</TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">Done ({groups.completed.length})</TabsTrigger>
        </TabsList>
        {Object.entries(groups).map(([key, items]) => (
          <TabsContent key={key} value={key} className="space-y-3 mt-4">
            {items.map((t) => (
              <Link to={`/engineer/tickets/${t.id}`} key={t.id}>
                <Card className={`p-4 rounded-md border-l-4 border-status-${t.status} hover-lift mb-3`}
                      data-testid={`eng-ticket-${t.ticket_number}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-signal text-sm">{t.ticket_number}</span>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="font-semibold text-navy text-sm">{t.customer_name}</div>
                  <div className="text-xs text-slate-500 truncate">{t.device?.brand} {t.device?.model}</div>
                  <div className="text-xs text-slate-400 mt-2 flex items-center justify-between">
                    <span>{formatDate(t.created_at)}</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </Card>
              </Link>
            ))}
            {items.length === 0 && (
              <Card className="p-8 text-center text-sm text-slate-500 rounded-md">
                No tickets here.
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
