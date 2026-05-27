import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, User as UserIcon, Phone, Building2, Cpu, ShieldCheck,
  FileText, MapPin, Image as ImageIcon, Wrench, CheckCircle2,
  Clock, Activity, Download, BadgeCheck, Wifi, UserCheck, Pencil,
  ExternalLink, DollarSign } from "lucide-react";
import { api, formatError, API } from "../../lib/api";
import { Input } from "../../components/ui/input";
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
  const [isReassign, setIsReassign] = useState(false);
  const [selectedEng, setSelectedEng] = useState("");
  const [isOutsource, setIsOutsource] = useState(false);
  const [outsourceForm, setOutsourceForm] = useState({ name: "", company: "", phone: "", price: "", notes: "" });
  const [reportOpen, setReportOpen] = useState(false);
  const [reportForm, setReportForm] = useState({ work_done: "", resolution_summary: "" });
  const [completing, setCompleting] = useState(false);
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
    setEngineers(Array.isArray(data) ? data : data.items || []);
  };

  const openAssign = async (reassign = false) => {
    await loadEngineers();
    setIsReassign(reassign);
    setSelectedEng(reassign ? ticket.assigned_engineer_id : "");
    setAssignOpen(true);
  };

  const assign = async () => {
    try {
      if (isOutsource) {
        if (!outsourceForm.name) { toast.error("Outsource engineer name required"); return; }
        await api.post(`/tickets/${id}/assign`, {
          is_outsource: true,
          outsource_name: outsourceForm.name,
          outsource_company: outsourceForm.company,
          outsource_phone: outsourceForm.phone,
          outsource_price: outsourceForm.price ? parseFloat(outsourceForm.price) : null,
          outsource_notes: outsourceForm.notes,
        });
        toast.success("Outsourced successfully");
      } else {
        if (!selectedEng) { toast.error("Please select an engineer"); return; }
        await api.post(`/tickets/${id}/assign`, { engineer_id: selectedEng, is_outsource: false });
        toast.success(isReassign ? "Engineer reassigned" : "Engineer assigned");
      }
      setAssignOpen(false);
      load();
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail));
    }
  };

  const outsourceComplete = async () => {
    if (!window.confirm("Mark this outsource ticket as completed?")) return;
    setCompleting(true);
    try {
      await api.post(`/tickets/${id}/outsource-complete`);
      toast.success("Ticket marked as completed");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally { setCompleting(false); }
  };

  const submitServiceReport = async () => {
    if (!reportForm.work_done) { toast.error("Work done description is required"); return; }
    try {
      await api.post(`/tickets/${id}/service-report`, reportForm);
      toast.success("Service report PDF generated");
      setReportOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
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

  const downloadOutsourcePdf = () => {
    const token = localStorage.getItem("token");
    window.open(`${API}/tickets/${id}/outsource-pdf?auth=${token}`, "_blank");
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
            <Button onClick={() => { setIsOutsource(false); openAssign(false); }} className="bg-navy hover:bg-navy/90 text-white rounded-md"
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold text-navy">{ticket.engineer.name}</div>
                    {ticket.engineer.is_remote && (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        <Wifi className="w-2.5 h-2.5" /> Remote
                      </span>
                    )}
                  </div>
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
              <Button onClick={() => { setIsOutsource(false); openAssign(false); }}
                className="w-full bg-navy hover:bg-navy/90 text-white">
                Assign engineer
              </Button>
            )}

            {/* Outsource details */}
            {ticket.is_outsource && ticket.outsource && (
              <div className="mt-3 p-3 rounded-md bg-orange-50 border border-orange-200 space-y-1 text-xs">
                <div className="font-bold text-orange-700 flex items-center gap-1 mb-2">
                  <ExternalLink className="w-3 h-3" /> Outsource Engineer
                </div>
                <div><span className="font-semibold">Name:</span> {ticket.outsource.name}</div>
                {ticket.outsource.company && <div><span className="font-semibold">Location:</span> {ticket.outsource.company}</div>}
                {ticket.outsource.phone && <div><span className="font-semibold">Phone:</span> {ticket.outsource.phone}</div>}
                {ticket.outsource.price != null && (
                  <div className="font-bold text-orange-800 text-sm mt-1 flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> Service Charge: ₹{Number(ticket.outsource.price).toLocaleString()}
                  </div>
                )}
                {ticket.outsource.notes && <div className="text-slate-500 italic mt-1">{ticket.outsource.notes}</div>}
                <button onClick={downloadOutsourcePdf}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-bold text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-md py-2 transition-colors">
                  <Download className="w-3.5 h-3.5" /> Download internal PDF (accounts)
                </button>
              </div>
            )}

            {/* Outsource complete button */}
            {ticket.is_outsource && !["closed","report_generated"].includes(ticket.status) && (
              <button onClick={outsourceComplete} disabled={completing}
                className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-md py-2 transition-colors disabled:opacity-50">
                {completing ? "Completing…" : "✓ Mark outsource as completed"}
              </button>
            )}

            {/* Generate service report button */}
            {(ticket.is_outsource || ["closed","report_generated"].includes(ticket.status)) && (
              <button onClick={() => setReportOpen(true)}
                className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-bold text-navy border-2 border-navy hover:bg-navy hover:text-white rounded-md py-2 transition-colors">
                <FileText className="w-3.5 h-3.5" /> Generate service report
              </button>
            )}

            {(ticket.engineer || ticket.is_outsource) && (
              <button onClick={() => { setIsOutsource(false); openAssign(true); }}
                className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-navy hover:bg-slate-50 rounded-md py-2 border border-slate-200 transition-colors">
                <Pencil className="w-3 h-3" /> Reassign engineer
              </button>
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
      {/* Assign / Outsource Dialog */}
      <Dialog open={assignOpen} onOpenChange={(v) => { setAssignOpen(v); if (!v) setIsOutsource(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isReassign ? "Reassign engineer" : "Assign engineer"}</DialogTitle>
          </DialogHeader>

          {/* Toggle */}
          <div className="flex rounded-md overflow-hidden border border-slate-200">
            <button onClick={() => setIsOutsource(false)}
              className={`flex-1 py-2 text-xs font-bold transition-colors ${!isOutsource ? "bg-navy text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
              Internal Engineer
            </button>
            <button onClick={() => setIsOutsource(true)}
              className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1 transition-colors ${isOutsource ? "bg-orange-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
              <ExternalLink className="w-3 h-3" /> Outsource
            </button>
          </div>

          {!isOutsource ? (
            <Select value={selectedEng} onValueChange={setSelectedEng}>
              <SelectTrigger data-testid="assign-engineer-select">
                <SelectValue placeholder="Choose available engineer…" />
              </SelectTrigger>
              <SelectContent>
                {engineers.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} — {e.active_tickets} active • {e.skills?.join(", ") || "no skills"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="space-y-3">
              <div className="p-2 rounded bg-orange-50 border border-orange-100 text-xs text-orange-700">
                Details will be saved with the ticket and shown in the internal PDF report.
              </div>
              <div>
                <label className="text-xs font-bold">Engineer Name *</label>
                <Input className="mt-1" value={outsourceForm.name}
                  onChange={e => setOutsourceForm({...outsourceForm, name: e.target.value})}
                  placeholder="Full name" />
              </div>
              <div>
                <label className="text-xs font-bold">Location</label>
                <Input className="mt-1" value={outsourceForm.company}
                  onChange={e => setOutsourceForm({...outsourceForm, company: e.target.value})}
                  placeholder="e.g. Andheri, Mumbai" />
              </div>
              <div>
                <label className="text-xs font-bold">Phone</label>
                <Input className="mt-1" value={outsourceForm.phone}
                  onChange={e => setOutsourceForm({...outsourceForm, phone: e.target.value})}
                  placeholder="Contact number" />
              </div>
              <div>
                <label className="text-xs font-bold">Service Price (₹)</label>
                <Input className="mt-1" type="number" value={outsourceForm.price}
                  onChange={e => setOutsourceForm({...outsourceForm, price: e.target.value})}
                  placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs font-bold">Notes</label>
                <Input className="mt-1" value={outsourceForm.notes}
                  onChange={e => setOutsourceForm({...outsourceForm, notes: e.target.value})}
                  placeholder="Any additional notes" />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={assign}
              className={isOutsource ? "bg-orange-500 hover:bg-orange-600" : "bg-navy hover:bg-navy/90"}
              data-testid="confirm-assign-btn">
              {isOutsource ? "Outsource" : isReassign ? "Reassign" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Generate Service Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Pre-filled info */}
            <div className="p-3 rounded-md bg-slate-50 border text-sm space-y-1">
              <div><span className="font-bold">Customer:</span> {ticket?.customer_name}</div>
              <div><span className="font-bold">Company:</span> {ticket?.company?.company_name || ticket?.customer_company || "—"}</div>
              <div><span className="font-bold">Device:</span> {ticket?.device?.brand} {ticket?.device?.model}</div>
              <div><span className="font-bold">Problem:</span> {ticket?.problem_description}</div>
              {ticket?.is_outsource && ticket?.outsource && (
                <div className="mt-2 pt-2 border-t">
                  <div className="text-xs font-bold text-orange-600 mb-1">OUTSOURCE ENGINEER</div>
                  <div><span className="font-bold">Name:</span> {ticket.outsource.name}</div>
                  {ticket.outsource.company && <div><span className="font-bold">Location:</span> {ticket.outsource.company}</div>}
                  {ticket.outsource.price != null && <div className="font-bold text-orange-700">Charge: ₹{Number(ticket.outsource.price).toLocaleString()}</div>}
                </div>
              )}
              {!ticket?.is_outsource && ticket?.engineer && (
                <div><span className="font-bold">Engineer:</span> {ticket.engineer.name}</div>
              )}
            </div>
            <div>
              <label className="text-xs font-bold">Work done *</label>
              <textarea
                value={reportForm.work_done}
                onChange={e => setReportForm({...reportForm, work_done: e.target.value})}
                placeholder="Describe the work performed…"
                className="w-full mt-1 p-2 border rounded-md text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            </div>
            <div>
              <label className="text-xs font-bold">Resolution summary <span className="text-slate-400 font-normal">(optional)</span></label>
              <Input className="mt-1" value={reportForm.resolution_summary}
                onChange={e => setReportForm({...reportForm, resolution_summary: e.target.value})}
                placeholder="Brief summary for the client" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button onClick={submitServiceReport} className="bg-navy hover:bg-navy/90">
              <FileText className="w-4 h-4 mr-2" /> Generate PDF
            </Button>
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