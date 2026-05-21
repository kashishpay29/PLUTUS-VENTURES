import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle2, XCircle, Truck, MapPin, Wrench, FileSignature,
  Camera, Trash2, Plus, Loader2, FileDown, Phone, Cpu, ShieldCheck,
  Clock
} from "lucide-react";
import { api, formatError, API } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter
} from "../../components/ui/drawer";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "../../components/ui/select";
import { StatusBadge, formatDate } from "../../lib/status";

const NEXT_STATUS = {
  assigned: { next: "accepted", label: "Accept ticket", icon: CheckCircle2, color: "bg-emerald-600" },
  accepted: { next: "travelling", label: "Start travelling", icon: Truck, color: "bg-cyan-600" },
  travelling: { next: "reached_site", label: "Reached site", icon: MapPin, color: "bg-emerald-600" },
  reached_site: { next: "in_progress", label: "Start work", icon: Wrench, color: "bg-orange-600" },
  in_progress: { next: null, label: "Submit report", icon: FileSignature, color: "bg-navy" },
};

export default function EngineerTicketDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [reportOpen, setReportOpen] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get(`/tickets/${id}`);
      setTicket(data);
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail));
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendLocation = async (status) => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  };

  const updateStatus = async (status, note) => {
    const loc = await sendLocation(status);
    try {
      await api.post(`/tickets/${id}/status`, {
        status, note, ...(loc || {}),
      });
      toast.success(`Status: ${status.replace(/_/g, " ")}`);
      load();
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail));
    }
  };

  const reject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    try {
      await api.post(`/tickets/${id}/status`, {
        status: "rejected", reject_reason: rejectReason,
      });
      toast.success("Ticket rejected");
      setRejectOpen(false);
      nav("/engineer/tickets");
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail));
    }
  };

  if (!ticket) return <div className="p-4 text-slate-500">Loading…</div>;

  const action = NEXT_STATUS[ticket.status];
  const d = ticket.device;

  return (
    <div className="px-4 py-4 space-y-4 pb-32" data-testid="engineer-ticket-detail">
      <button onClick={() => nav(-1)} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono font-bold text-signal text-sm">{ticket.ticket_number}</div>
          <h1 className="font-display font-black text-xl text-navy mt-1">{ticket.customer_name}</h1>
        </div>
        <StatusBadge status={ticket.status} />
      </div>

      {/* Quick info */}
      <Card className="p-4 rounded-md space-y-2">
        <Row icon={Phone} label="Phone" value={
          <a href={`tel:${ticket.customer_phone}`} className="text-signal font-semibold">
            {ticket.customer_phone}
          </a>
        } />
        <Row icon={Cpu} label="Device" value={`${d?.brand || ""} ${d?.model || ""}`} />
        <Row label="Device ID" value={<span className="font-mono text-xs">{d?.device_id}</span>} />
        <Row label="Serial" value={<span className="font-mono text-xs">{d?.serial_number || "—"}</span>} />
        <Row icon={ShieldCheck} label="Warranty" value={
          <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${
            d?.warranty_status === "active" ? "bg-emerald-50 text-emerald-700" :
            d?.warranty_status === "expired" ? "bg-amber-50 text-amber-700" :
            "bg-slate-100 text-slate-600"
          }`}>{d?.warranty_status}</span>
        } />
      </Card>

      <Card className="p-4 rounded-md">
        <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">Problem reported</div>
        <p className="text-sm whitespace-pre-wrap text-navy">{ticket.problem_description}</p>
      </Card>

      {ticket.device_history?.length > 0 && (
        <Card className="p-4 rounded-md">
          <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">Service history</div>
          <div className="space-y-2">
            {ticket.device_history.slice(0, 3).map((h) => (
              <div key={h.ticket_number} className="text-xs p-2 bg-slate-50 rounded">
                <div className="font-mono font-bold text-signal">{h.ticket_number}</div>
                <div className="text-slate-600 truncate">{h.problem_description}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {ticket.report && (
        <Card className="p-4 rounded-md bg-emerald-50/50 border-emerald-100">
          <div className="text-xs uppercase tracking-wider font-bold text-emerald-700 mb-2">Report submitted</div>
          <p className="text-sm">{ticket.report.work_notes}</p>
          {ticket.pdf_path && (
            <Button
              variant="outline"
              className="mt-3 w-full"
              onClick={() => window.open(`${API}/tickets/${id}/pdf?auth=${localStorage.getItem("token")}`, "_blank")}
              data-testid="engineer-download-pdf-btn"
            >
              <FileDown className="w-4 h-4 mr-2" /> View signed PDF
            </Button>
          )}
        </Card>
      )}

      {/* Activity timeline */}
      {ticket.activity?.length > 0 && (
        <Card className="p-4 rounded-md">
          <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3">Activity</div>
          <div className="space-y-2">
            {ticket.activity.slice(0, 6).map((a) => (
              <div key={a.id} className="text-xs flex items-start gap-2">
                <Clock className="w-3 h-3 text-slate-400 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-navy">{a.action.replace(/_/g, " ")}</div>
                  <div className="text-slate-500">{formatDate(a.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Bottom action bar */}
      {action && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-4 z-30">
          <div className="flex gap-2">
            {ticket.status === "assigned" && (
              <Button
                variant="outline"
                onClick={() => setRejectOpen(true)}
                className="flex-1 h-12 border-red-200 text-red-600"
                data-testid="reject-ticket-btn"
              >
                <XCircle className="w-4 h-4 mr-1" /> Reject
              </Button>
            )}
            <Button
              onClick={() => action.next ? updateStatus(action.next) : setReportOpen(true)}
              className={`flex-1 h-12 ${action.color} hover:opacity-90 text-white font-bold rounded-md`}
              data-testid="engineer-action-btn"
            >
              <action.icon className="w-4 h-4 mr-1" /> {action.label}
            </Button>
          </div>
        </div>
      )}

      {/* Reject drawer */}
      <Drawer open={rejectOpen} onOpenChange={setRejectOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Reject ticket</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-3">
            <Label className="text-xs font-bold">Reason</Label>
            <Select value={rejectReason} onValueChange={setRejectReason}>
              <SelectTrigger><SelectValue placeholder="Choose a reason…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Out of skill set">Out of my skill set</SelectItem>
                <SelectItem value="Location too far">Location too far</SelectItem>
                <SelectItem value="Already busy">Already busy with another job</SelectItem>
                <SelectItem value="Personal reasons">Personal reasons</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Add details…"
              value={rejectReason.startsWith("Other:") ? rejectReason.replace("Other:", "") : ""}
              onChange={(e) => setRejectReason("Other: " + e.target.value)}
              rows={3}
            />
          </div>
          <DrawerFooter>
            <Button onClick={reject} className="bg-red-600 hover:bg-red-700" data-testid="confirm-reject-btn">
              Reject ticket
            </Button>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Report drawer */}
      {reportOpen && (
        <ReportDrawer
          ticket={ticket}
          onClose={() => setReportOpen(false)}
          onSubmitted={() => { setReportOpen(false); load(); }}
        />
      )}
    </div>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {Icon && <Icon className="w-4 h-4 text-slate-400" />}
      <span className="text-xs uppercase tracking-wider text-slate-500 font-bold w-20">{label}</span>
      <span className="flex-1 text-navy">{value}</span>
    </div>
  );
}


// --------------- Custom signature pad (no external dep) ---------------
function SignaturePad({ sigRef }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#0A1128";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return { x: src.clientX - r.left, y: src.clientY - r.top };
    };

    const start = (e) => { e.preventDefault(); drawing.current = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const move  = (e) => { e.preventDefault(); if (!drawing.current) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const stop  = ()  => { drawing.current = false; };

    canvas.addEventListener("mousedown",  start);
    canvas.addEventListener("mousemove",  move);
    canvas.addEventListener("mouseup",    stop);
    canvas.addEventListener("mouseleave", stop);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove",  move,  { passive: false });
    canvas.addEventListener("touchend",   stop);

    return () => {
      canvas.removeEventListener("mousedown",  start);
      canvas.removeEventListener("mousemove",  move);
      canvas.removeEventListener("mouseup",    stop);
      canvas.removeEventListener("mouseleave", stop);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove",  move);
      canvas.removeEventListener("touchend",   stop);
    };
  }, []);

  // Expose clear() and toDataURL() via ref
  useEffect(() => {
    if (!sigRef) return;
    sigRef.current = {
      clear: () => {
        const c = canvasRef.current;
        if (c) c.getContext("2d").clearRect(0, 0, c.width, c.height);
      },
      isEmpty: () => {
        const c = canvasRef.current;
        if (!c) return true;
        const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        return !d.some((v) => v !== 0);
      },
      getTrimmedCanvas: () => canvasRef.current,
    };
  }, [sigRef]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={160}
      data-testid="signature-canvas"
      style={{ width: "100%", height: "160px", touchAction: "none" }}
    />
  );
}
// -----------------------------------------------------------------------

function ReportDrawer({ ticket, onClose, onSubmitted }) {
  const [workNotes, setWorkNotes] = useState("");
  const [parts, setParts] = useState([]);
  const [photosBefore, setPhotosBefore] = useState([]);
  const [photosAfter, setPhotosAfter] = useState([]);
  const [signedName, setSignedName] = useState(ticket.customer_name || "");
  const [submitting, setSubmitting] = useState(false);
  const sigRef = useRef(null);

  const addPart = () => setParts([...parts, { name: "", part_number: "", quantity: 1 }]);
  const updatePart = (i, k, v) => {
    const next = [...parts]; next[i][k] = v; setParts(next);
  };
  const removePart = (i) => setParts(parts.filter((_, idx) => idx !== i));

  const handleFile = async (e, setter, current) => {
    const files = Array.from(e.target.files || []);
    const dataUrls = await Promise.all(files.map(toDataUrl));
    setter([...current, ...dataUrls]);
  };

  const toDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // compress to ~1024px max
      const img = new Image();
      img.onload = () => {
        const max = 1024;
        let { width, height } = img;
        if (width > height && width > max) { height = (height * max) / width; width = max; }
        else if (height > max) { width = (width * max) / height; height = max; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const submit = async () => {
    if (!workNotes.trim()) return toast.error("Add engineer notes");
    if (!sigRef.current || sigRef.current.isEmpty()) return toast.error("Capture customer signature");
    const sig = sigRef.current.getTrimmedCanvas().toDataURL("image/png");
    setSubmitting(true);
    try {
      await api.post(`/tickets/${ticket.id}/report`, {
        engineer_notes: workNotes,
        resolution_summary: workNotes,
        parts_used: parts.filter((p) => p.name.trim()),
        before_images: photosBefore,
        after_images: photosAfter,
        customer_signature: sig,
        customer_signed_name: signedName,
      });
      toast.success("Report submitted & PDF generated");
      onSubmitted();
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer open onOpenChange={(v) => !v && onClose()}>
      <DrawerContent className="h-[92vh]">
        <DrawerHeader>
          <DrawerTitle>Service report — {ticket.ticket_number}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-4 overflow-auto space-y-4 flex-1">
          <div>
            <Label className="text-xs font-bold">Work notes</Label>
            <Textarea value={workNotes} onChange={(e) => setWorkNotes(e.target.value)} rows={4}
                      placeholder="Describe the work performed…"
                      data-testid="work-notes-input" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-bold">Parts used</Label>
              <button onClick={addPart} className="text-xs font-bold text-signal flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {parts.length === 0 && <div className="text-xs text-slate-400">No parts added</div>}
            <div className="space-y-2">
              {parts.map((p, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <Input className="col-span-5" placeholder="Part name" value={p.name}
                         onChange={(e) => updatePart(i, "name", e.target.value)} />
                  <Input className="col-span-4 font-mono text-xs" placeholder="Part #" value={p.part_number}
                         onChange={(e) => updatePart(i, "part_number", e.target.value)} />
                  <Input className="col-span-2" type="number" min="1" value={p.quantity}
                         onChange={(e) => updatePart(i, "quantity", parseInt(e.target.value) || 1)} />
                  <button className="col-span-1 grid place-items-center text-red-500" onClick={() => removePart(i)}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <PhotoUploader label="Photos — Before" photos={photosBefore} onChange={setPhotosBefore} testid="photos-before" />
          <PhotoUploader label="Photos — After" photos={photosAfter} onChange={setPhotosAfter} testid="photos-after" />

          <div>
            <Label className="text-xs font-bold">Customer name (for sign-off)</Label>
            <Input value={signedName} onChange={(e) => setSignedName(e.target.value)}
                   data-testid="signed-name-input" />
          </div>

          <div>
            <Label className="text-xs font-bold flex items-center gap-1">
              <FileSignature className="w-3.5 h-3.5" /> Customer signature
            </Label>
            <div className="mt-2 border-2 border-dashed border-slate-300 rounded-md bg-white">
              <SignaturePad sigRef={sigRef} />
            </div>
            <div className="flex justify-between items-center mt-1">
              <button className="text-xs text-slate-500" onClick={() => sigRef.current?.clear()}>
                Clear
              </button>
              <span className="text-xs text-slate-400">Customer signs above</span>
            </div>
          </div>
        </div>
        <DrawerFooter>
          <Button onClick={submit} disabled={submitting} className="bg-navy hover:bg-navy/90 text-white font-bold h-12"
                  data-testid="submit-report-btn">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit & Generate PDF"}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function PhotoUploader({ label, photos, onChange, testid }) {
  const inputRef = useRef(null);
  return (
    <div>
      <Label className="text-xs font-bold flex items-center gap-1">
        <Camera className="w-3.5 h-3.5" /> {label}
      </Label>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {photos.map((src, i) => (
          <div key={i} className="relative aspect-square">
            <img src={src} alt="" className="w-full h-full object-cover rounded border border-slate-200" />
            <button
              onClick={() => onChange(photos.filter((_, idx) => idx !== i))}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white grid place-items-center"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        <button
          onClick={() => inputRef.current?.click()}
          className="aspect-square rounded border-2 border-dashed border-slate-300 grid place-items-center text-slate-400 hover:border-signal hover:text-signal"
          data-testid={`${testid}-add-btn`}
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          Promise.all(files.map((f) => new Promise((res) => {
            const r = new FileReader();
            r.onload = () => {
              const img = new Image();
              img.onload = () => {
                const max = 1024;
                let { width, height } = img;
                if (width > height && width > max) { height = (height * max) / width; width = max; }
                else if (height > max) { width = (width * max) / height; height = max; }
                const c = document.createElement("canvas");
                c.width = width; c.height = height;
                c.getContext("2d").drawImage(img, 0, 0, width, height);
                res(c.toDataURL("image/jpeg", 0.85));
              };
              img.src = r.result;
            };
            r.readAsDataURL(f);
          }))).then((urls) => {
            onChange([...photos, ...urls]);
          });
          e.target.value = "";
        }}
      />
    </div>
  );
}