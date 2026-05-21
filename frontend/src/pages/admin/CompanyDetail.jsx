import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, Building2, MapPin, Phone, Mail, FileText, Cpu,
  PlusCircle, Loader2, Pencil, Save, X
} from "lucide-react";
import { api, formatError } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import { StatusBadge, formatDate } from "../../lib/status";

export default function CompanyDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  // const load = async () => {
  //   try {
  //     const { data } = await api.get(`/companies/${id}`);
  //     setData(data);
  //     setForm(data.company);
  //   } catch (err) {
  //     toast.error(formatError(err.response?.data?.detail));
  //   }
  // };
  
  const load = async () => {
    try {
      const { data: res } = await api.get(`/companies/${id}`);
      setData(res);
      setForm(res.company);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      delete payload.id; delete payload.company_code;
      delete payload.created_at; delete payload.updated_at; delete payload.created_by;
      await api.put(`/companies/${id}`, payload);
      toast.success("Company updated");
      setEditing(false);
      load();
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail));
    } finally { setSaving(false); }
  };

  const toggleStatus = async () => {
    const newStatus = data.company.status === "active" ? "inactive" : "active";
    try {
      await api.put(`/companies/${id}`, { status: newStatus });
      toast.success(`Marked ${newStatus}`);
      load();
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail));
    }
  };

  if (!data) return <div className="text-slate-500">Loading…</div>;

  const c = editing ? form : data.company;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6" data-testid="company-detail-page">
      <button onClick={() => nav(-1)} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-navy uppercase tracking-wider">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-md bg-navy/5 grid place-items-center">
            <Building2 className="w-6 h-6 text-navy" />
          </div>
          <div>
            <div className="font-mono text-xs font-bold text-signal">{c.company_code}</div>
            <h1 className="font-display font-black text-3xl tracking-tight text-navy">{c.company_name}</h1>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                c.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${c.status === "active" ? "bg-emerald-500" : "bg-slate-400"}`} />
                {c.status}
              </span>
              <span>Created {formatDate(c.created_at)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-slate-50">
            <span className="text-xs text-slate-600">Active</span>
            <Switch checked={c.status === "active"} onCheckedChange={toggleStatus}
                    data-testid="company-status-toggle" />
          </div>
          {!editing && (
            <Button onClick={() => setEditing(true)} variant="outline" data-testid="company-edit-btn">
              <Pencil className="w-4 h-4 mr-2" /> Edit
            </Button>
          )}
          {editing && (
            <>
              <Button onClick={() => { setEditing(false); setForm(data.company); }} variant="outline">
                <X className="w-4 h-4 mr-2" /> Cancel
              </Button>
              <Button onClick={save} disabled={saving} className="bg-navy hover:bg-navy/90 text-white" data-testid="company-save-edit-btn">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Save</>}
              </Button>
            </>
          )}
          <Link to={`/admin/tickets/new?company_id=${id}`}>
            <Button className="bg-signal hover:bg-signal/90 text-white" data-testid="create-ticket-for-company-btn">
              <PlusCircle className="w-4 h-4 mr-2" /> New ticket
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 rounded-md">
            <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-4">
              {editing ? "Edit details" : "Contact details"}
            </h3>
            {!editing && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <KV label="Contact person" value={c.contact_person || "—"} />
                <KV label="Phone" icon={Phone} value={c.phone || "—"} />
                <KV label="Email" icon={Mail} value={c.email || "—"} />
                <KV label="GST number" value={<span className="font-mono">{c.gst_number || "—"}</span>} />
                <KV label="Client email" icon={Mail} value={c.client_email || "—"} />
                <KV label="Product ref no." value={<span className="font-mono">{c.product_ref_number || "—"}</span>} />
                <KV label="OEM ref no." value={<span className="font-mono">{c.oem_ref_number || "—"}</span>} />
                <div className="sm:col-span-2">
                  <KV label="Address" icon={MapPin} value={
                    <>
                      {c.address || "—"}
                      {(c.city || c.state || c.pincode) && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          {[c.city, c.state, c.pincode].filter(Boolean).join(" • ")}
                        </div>
                      )}
                    </>
                  } />
                </div>
              </div>
            )}
            {editing && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label className="text-xs font-bold">Company name *</Label>
                  <Input value={form.company_name || ""} onChange={(e) => set("company_name", e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label className="text-xs font-bold">Contact person</Label>
                  <Input value={form.contact_person || ""} onChange={(e) => set("contact_person", e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label className="text-xs font-bold">Phone</Label>
                  <Input value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label className="text-xs font-bold">Email</Label>
                  <Input type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label className="text-xs font-bold">Client email <span className="text-slate-400 font-normal">(for auto-notifications)</span></Label>
                  <Input type="email" value={form.client_email || ""} onChange={(e) => set("client_email", e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label className="text-xs font-bold">GST number</Label>
                  <Input value={form.gst_number || ""} onChange={(e) => set("gst_number", e.target.value)} className="mt-1.5 font-mono uppercase" />
                </div>
                <div>
                  <Label className="text-xs font-bold">Product ref no. <span className="text-slate-400 font-normal">(optional)</span></Label>
                  <Input value={form.product_ref_number || ""} onChange={(e) => set("product_ref_number", e.target.value)} className="mt-1.5 font-mono" />
                </div>
                <div>
                  <Label className="text-xs font-bold">OEM ref no. <span className="text-slate-400 font-normal">(optional)</span></Label>
                  <Input value={form.oem_ref_number || ""} onChange={(e) => set("oem_ref_number", e.target.value)} className="mt-1.5 font-mono" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs font-bold">Address</Label>
                  <Textarea rows={2} value={form.address || ""} onChange={(e) => set("address", e.target.value)} className="mt-1.5" />
                </div>
                <div><Label className="text-xs font-bold">City</Label>
                  <Input value={form.city || ""} onChange={(e) => set("city", e.target.value)} className="mt-1.5" /></div>
                <div><Label className="text-xs font-bold">State</Label>
                  <Input value={form.state || ""} onChange={(e) => set("state", e.target.value)} className="mt-1.5" /></div>
                <div><Label className="text-xs font-bold">Pincode</Label>
                  <Input value={form.pincode || ""} onChange={(e) => set("pincode", e.target.value)} className="mt-1.5 font-mono" /></div>
              </div>
            )}
          </Card>

          <Card className="p-6 rounded-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold flex items-center gap-2">
                <FileText className="w-4 h-4" /> Recent tickets ({data.tickets.length})
              </h3>
            </div>
            {data.tickets.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-8">No tickets yet</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.tickets.map((t) => (
                  <Link to={`/admin/tickets/${t.id}`} key={t.id}
                        className="flex items-center justify-between py-3 hover:bg-slate-50 -mx-3 px-3 rounded">
                    <div>
                      <div className="font-mono font-bold text-signal text-sm">{t.ticket_no || t.ticket_number}</div>
                      <div className="text-sm text-slate-700 truncate max-w-md">{t.issue_description || t.problem_description}</div>
                    </div>
                    <StatusBadge status={t.status} />
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="p-6 rounded-md">
          <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold flex items-center gap-2 mb-4">
            <Cpu className="w-4 h-4" /> Devices ({data.devices.length})
          </h3>
          {data.devices.length === 0 ? (
            <div className="text-sm text-slate-500">No devices registered yet</div>
          ) : (
            <div className="space-y-2">
              {data.devices.map((d) => (
                <div key={d.device_id} className="p-3 bg-slate-50 rounded text-sm">
                  <div className="font-mono text-xs font-bold text-signal">{d.device_id}</div>
                  <div className="font-semibold text-navy">{d.brand} {d.model}</div>
                  {d.serial_number && <div className="text-xs font-mono text-slate-500">SN: {d.serial_number}</div>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
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