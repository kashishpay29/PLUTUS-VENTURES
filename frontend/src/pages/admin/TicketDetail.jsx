import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, User as UserIcon, Phone, Building2, Cpu, ShieldCheck,
  FileText, MapPin, Image as ImageIcon, Wrench, CheckCircle2,
  Clock, Activity, Download, BadgeCheck
} from "lucide-react";
import { api, formatError, API } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "../../components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "../../components/ui/dialog";
import { StatusBadge, formatDate } from "../../lib/status";
import LiveMap from "../../components/LiveMap";

export default function TicketDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [engineers, setEngineers] = useState([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedEng, setSelectedEng] = useState("");
  const [approving, setApproving] = useState(false);

 const load = useCallback(async () => {
  try {
    const { data } = await api.get(`/tickets/${id}`);
    setTicket(data);
  } catch (err) {
    toast.error(formatError(err.response?.data?.detail));
  }
}, [id]);

  useEffect(() => {
  load();
  const t = setInterval(load, 10000);
  return () => clearInterval(t);
}, [load]);


  const loadEngineers = async () => {
    const { data } = await api.get("/engineers?available_only=true");
    setEngineers(data);
  };

  const openAssign = async () => {
    await loadEngineers();
    setAssignOpen(true);
  };

  const assign = async () => {
    if (!selectedEng) return;
    try {
      await api.post(`/tickets/${id}/assign`, { engineer_id: selectedEng });
      toast.success("Engineer assigned");
      setAssignOpen(false);
      load();
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail));
    }
  };

  const approve = async () => {
    setApproving(true);
    try {
      await api.post(`/tickets/${id}/approve`);
      toast.success("Report approved & ticket closed");
      load();
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail));
    } finally { setApproving(false); }
  };

  const downloadPdf = () => {
    const token = localStorage.getItem("token");
    const url = `${API}/tickets/${id}/pdf?auth=${token}`;
    window.open(url, "_blank");
  };

  if (!ticket) return <div className="text-slate-500">Loading…</div>;

  const d = ticket.device;
  const report = ticket.report;

  return (
    <div className="space-y-6" data-testid="admin-ticket-detail">
      <button onClick={() => nav(-1)} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-navy uppercase tracking-wider">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono font-bold text-signal">{ticket.ticket_number}</span>
            <StatusBadge status={ticket.status} />
            {ticket.approved && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                <BadgeCheck className="w-3.5 h-3.5" /> Approved
              </span>
            )}
          </div>
          <h1 className="font-display font-black text-3xl tracking-tight text-navy">{ticket.customer_name}</h1>
          <div className="text-sm text-slate-500 mt-1">
            Created {formatDate(ticket.created_at)} • Updated {formatDate(ticket.updated_at)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!ticket.engineer && (
            <Button onClick={openAssign} className="bg-navy hover:bg-navy/90 text-white rounded-md"
                    data-testid="assign-engineer-btn">
              Assign engineer
            </Button>
          )}
          {(ticket.status === "resolved" || ticket.status === "report_generated") && !ticket.approved && (
            <Button onClick={approve} disabled={approving}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-md"
                    data-testid="approve-report-btn">
              <CheckCircle2 className="w-4 h-4 mr-2" /> Approve & Close
            </Button>
          )}
          {ticket.pdf_path && (
            <Button onClick={downloadPdf} variant="outline" data-testid="download-pdf-btn">
              <Download className="w-4 h-4 mr-2" /> Download PDF
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col – details */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 rounded-md">
            <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-4">Customer & Device</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <KV icon={UserIcon} label="Customer" value={ticket.customer_name} />
              <KV icon={Phone} label="Phone" value={ticket.customer_phone} />
              <KV icon={Building2} label="Company" value={ticket.customer_company || "—"} />
              <KV label="Source" value={(ticket.contact_source || "").toUpperCase()} />
              <KV icon={Cpu} label="Device" value={`${d?.brand || ""} ${d?.model || ""}`} />
              <KV label="Device ID" value={<span className="font-mono">{d?.device_id}</span>} />
              <KV label="Serial No." value={<span className="font-mono">{d?.serial_number || "—"}</span>} />
              <KV icon={ShieldCheck} label="Warranty"
                  value={
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold uppercase ${
                      d?.warranty_status === "active" ? "bg-emerald-50 text-emerald-700" :
                      d?.warranty_status === "expired" ? "bg-amber-50 text-amber-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>{d?.warranty_status} {d?.warranty_expiry ? `• ${d.warranty_expiry}` : ""}</span>
                  } />
            </div>
          </Card>

          <Card className="p-6 rounded-md">
            <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Problem reported
            </h3>
            <p className="text-sm text-navy whitespace-pre-wrap">{ticket.problem_description}</p>
          </Card>

          {ticket.engineer_location && (
            <Card className="p-6 rounded-md">
              <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Engineer location
              </h3>
              <div className="h-72 rounded overflow-hidden border border-slate-200">
                <LiveMap markers={[{
                  lat: ticket.engineer_location.lat,
                  lng: ticket.engineer_location.lng,
                  label: ticket.engineer?.name || "Engineer",
                }]} />
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Updated {formatDate(ticket.engineer_location.updated_at)}
              </div>
            </Card>
          )}

          {report && (
            <Card className="p-6 rounded-md">
              <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-4 flex items-center gap-2">
                <Wrench className="w-4 h-4" /> Service report
              </h3>
              <div className="mb-4">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Work notes</div>
                <p className="text-sm whitespace-pre-wrap">{report.work_notes}</p>
              </div>
              {report.parts_used?.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Parts used</div>
                  <div className="space-y-1">
                    {report.parts_used.map((p, i) => (
                      <div key={i} className="text-sm flex items-center justify-between p-2 bg-slate-50 rounded">
                        <span>{p.name} {p.part_number && <span className="text-slate-500 font-mono text-xs">({p.part_number})</span>}</span>
                        <span className="font-mono font-bold">×{p.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(report.photos_before?.length > 0 || report.photos_after?.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <PhotoGroup label="Before" photos={report.photos_before} />
                  <PhotoGroup label="After" photos={report.photos_after} />
                </div>
              )}
              {report.customer_signature && (
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Customer signature</div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200 inline-block">
                    <img src={report.customer_signature} alt="signature" className="h-20" />
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Signed by {report.customer_signed_name || ticket.customer_name} • {formatDate(report.signed_at)}
                  </div>
                </div>
              )}
            </Card>
          )}

          {ticket.device_history?.length > 0 && (
            <Card className="p-6 rounded-md">
              <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-4">Device history</h3>
              <div className="space-y-2">
                {ticket.device_history.map((h) => (
                  <div key={h.ticket_number} className="text-sm p-3 rounded bg-slate-50 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-signal">{h.ticket_number}</span>
                      <span className="text-slate-600 ml-2">{h.problem_description?.slice(0, 60)}…</span>
                    </div>
                    <StatusBadge status={h.status} />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right col – engineer & activity */}
        <div className="space-y-6">
          <Card className="p-6 rounded-md">
            <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-3">Engineer</h3>
            {ticket.engineer ? (
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-navy text-white grid place-items-center font-bold">
                  {ticket.engineer.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-navy">{ticket.engineer.name}</div>
                  <div className="text-xs text-slate-500 truncate">{ticket.engineer.email}</div>
                  {ticket.engineer.skills?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {ticket.engineer.skills.map((s) => (
                        <span key={s} className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Button onClick={openAssign} className="w-full bg-navy hover:bg-navy/90 text-white">
                Assign engineer
              </Button>
            )}
          </Card>

          <Card className="p-6 rounded-md">
            <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Activity log
            </h3>
            <div className="space-y-3">
              {ticket.activity?.map((a) => (
                <div key={a.id} className="border-l-2 border-slate-200 pl-3">
                  <div className="text-xs uppercase tracking-wider font-bold text-navy">
                    {a.action.replace(/_/g, " ")}
                  </div>
                  <div className="text-xs text-slate-500">{a.actor_name} ({a.actor_role})</div>
                  {a.details && <div className="text-xs text-slate-600 mt-0.5">{a.details}</div>}
                  <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />{formatDate(a.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Assign Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign engineer</DialogTitle>
          </DialogHeader>
          <Select value={selectedEng} onValueChange={setSelectedEng}>
            <SelectTrigger data-testid="assign-engineer-select"><SelectValue placeholder="Choose available engineer…" /></SelectTrigger>
            <SelectContent>
              {engineers.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name} — {e.active_tickets} active • {e.skills?.join(", ") || "no skills"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={assign} className="bg-navy hover:bg-navy/90" data-testid="confirm-assign-btn">Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KV({ icon: Icon, label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />} {label}
      </div>
      <div className="mt-0.5 text-navy">{value}</div>
    </div>
  );
}

function PhotoGroup({ label, photos }) {
  return (
    <div>
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
        <ImageIcon className="w-3 h-3" /> {label}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((src, i) => (
          <img key={i} src={src} alt={`${label}-${i}`}
               className="w-full aspect-square object-cover rounded border border-slate-200" />
        ))}
        {photos.length === 0 && <div className="text-xs text-slate-400 col-span-3">—</div>}
      </div>
    </div>
  );
}
