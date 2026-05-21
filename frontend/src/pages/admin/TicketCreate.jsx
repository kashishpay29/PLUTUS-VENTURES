import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { api, formatError } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "../../components/ui/select";
import { ArrowLeft, Save, Loader2, Building2, PlusCircle, AlertCircle, Paperclip, X, ImageIcon } from "lucide-react";

export default function TicketCreate() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);

  const [form, setForm] = useState({
    company_id: params.get("company_id") || "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    contact_source: "call",
    issue_description: "",
    priority: "medium",
    product_reference_number: "",
    oem_reference_number: "",
    device: {
      brand: "", model: "", serial_number: "",
      device_name: "", device_type: "",
      warranty_status: "none", warranty_expiry: "",
      purchase_date: "",
    },
  });
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setD = (k, v) => setForm((f) => ({ ...f, device: { ...f.device, [k]: v } }));

  useEffect(() => {
    api.get("/companies?status=active&page_size=500")
      .then(({ data }) => setCompanies(data.items || []))
      .catch(() => {});
  }, []);

  // Auto-fill customer info when company changes
  useEffect(() => {
    if (!form.company_id) { setSelectedCompany(null); return; }
    const c = companies.find((x) => x.id === form.company_id);
    if (c) {
      setSelectedCompany(c);
      setForm((f) => ({
        ...f,
        customer_name: f.customer_name || c.contact_person || "",
        customer_phone: f.customer_phone || c.phone || "",
        customer_email: f.customer_email || c.client_email || c.email || "",
        product_reference_number: f.product_reference_number || c.product_ref_number || "",
        oem_reference_number: f.oem_reference_number || c.oem_ref_number || "",
      }));
    }
    // eslint-disable-next-line
  }, [form.company_id, companies]);


  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    if (photos.length + files.length > 5) return toast.error("Max 5 photos allowed");
    setUploading(true);
    try {
      const uploaded = await Promise.all(files.map(async (file) => {
        const fd = new FormData();
        fd.append("file", file);
        const { data } = await api.post("/upload", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        return { url: data.url, name: file.name };
      }));
      setPhotos((p) => [...p, ...uploaded]);
      toast.success();
    } catch (err) {
      toast.error("Photo upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removePhoto = (idx) => setPhotos((p) => p.filter((_, i) => i !== idx));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.company_id) return toast.error("Please select a company");
    if (!form.customer_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customer_email)) {
      return toast.error("Please enter a valid customer email");
    }
    setSaving(true);
    try {
      const payload = {
        photos: photos.map((p) => p.url),
        ...form,
        product_reference_number: form.product_reference_number?.trim() || null,
        oem_reference_number: form.oem_reference_number?.trim() || null,
        device: {
          ...form.device,
          serial_number: form.device.serial_number || null,
          warranty_expiry: form.device.warranty_expiry || null,
          purchase_date: form.device.purchase_date || null,
        },
      };
      const { data } = await api.post("/tickets", payload);
      toast.success(`Ticket ${data.ticket_no} created`);
      nav(`/admin/tickets/${data.id}`);
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail) || "Failed");
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-3xl space-y-6" data-testid="ticket-create-page">
      <button onClick={() => nav(-1)} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-navy uppercase tracking-wider">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">New ticket</div>
        <h1 className="font-display font-black text-3xl tracking-tight text-navy">Create service ticket</h1>
      </div>

      <form onSubmit={submit} className="space-y-6">
        {/* Company selector */}
        <Card className="p-6 rounded-md">
          <h3 className="font-bold text-navy mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4 text-signal" /> Company
          </h3>
          {companies.length === 0 ? (
            <div className="flex flex-col items-center text-center py-6 bg-amber-50 rounded-md border border-amber-100">
              <AlertCircle className="w-6 h-6 text-amber-600 mb-2" />
              <div className="text-sm font-semibold text-navy">No active companies yet</div>
              <div className="text-xs text-slate-500 mt-1">Add a company before creating tickets.</div>
              <Link to="/admin/companies/new" className="mt-3">
                <Button type="button" className="bg-navy hover:bg-navy/90 text-white">
                  <PlusCircle className="w-4 h-4 mr-2" /> Add company
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label className="text-xs font-bold">Select company *</Label>
                <Select value={form.company_id} onValueChange={(v) => setF("company_id", v)}>
                  <SelectTrigger className="mt-1.5 h-11" data-testid="company-select">
                    <SelectValue placeholder="Choose a company…" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="font-mono text-xs text-slate-500 mr-2">{c.company_code}</span>
                        {c.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedCompany && (
                <div className="sm:col-span-2 p-3 bg-slate-50 rounded-md border border-slate-200 text-xs">
                  <div className="font-mono font-bold text-signal mb-1">{selectedCompany.company_code}</div>
                  <div className="font-semibold text-navy text-sm">{selectedCompany.company_name}</div>
                  <div className="text-slate-600 mt-1">
                    {selectedCompany.contact_person && <span>{selectedCompany.contact_person} • </span>}
                    {selectedCompany.phone || ""}
                  </div>
                  {selectedCompany.address && (
                    <div className="text-slate-500 mt-0.5">{selectedCompany.address}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>

        {form.company_id && (
          <>
            <Card className="p-6 rounded-md">
              <h3 className="font-bold text-navy mb-4 text-sm uppercase tracking-wider">Customer (caller)</h3>
              <p className="text-xs text-slate-500 mb-3">
                Auto-filled from the company record. Override if the caller is a different person.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-bold">Caller name</Label>
                  <Input value={form.customer_name} onChange={(e) => setF("customer_name", e.target.value)}
                         className="mt-1.5" data-testid="customer-name-input" />
                </div>
                <div>
                  <Label className="text-xs font-bold">Phone</Label>
                  <Input value={form.customer_phone} onChange={(e) => setF("customer_phone", e.target.value)}
                         className="mt-1.5" data-testid="customer-phone-input" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs font-bold">
                    Customer email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    required
                    value={form.customer_email}
                    onChange={(e) => setF("customer_email", e.target.value)}
                    placeholder="customer@example.com"
                    className="mt-1.5"
                    data-testid="customer-email-input"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Closure email with the engineer's PDF report will be sent here when the ticket is approved.
                  </p>
                </div>
                <div>
                  <Label className="text-xs font-bold">Contact source</Label>
                  <Select value={form.contact_source} onValueChange={(v) => setF("contact_source", v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-bold">Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setF("priority", v)}>
                    <SelectTrigger className="mt-1.5" data-testid="priority-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            <Card className="p-6 rounded-md">
              <h3 className="font-bold text-navy mb-4 text-sm uppercase tracking-wider">Device</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-bold">Brand *</Label>
                  <Input value={form.device.brand} onChange={(e) => setD("brand", e.target.value)} required
                         placeholder="Dell / HP / Apple…" className="mt-1.5"
                         data-testid="device-brand-input" />
                </div>
                <div>
                  <Label className="text-xs font-bold">Model *</Label>
                  <Input value={form.device.model} onChange={(e) => setD("model", e.target.value)} required
                         placeholder="Latitude 5420" className="mt-1.5"
                         data-testid="device-model-input" />
                </div>
                <div>
                  <Label className="text-xs font-bold">Device type</Label>
                  <Select value={form.device.device_type || ""} onValueChange={(v) => setD("device_type", v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="laptop">Laptop</SelectItem>
                      <SelectItem value="desktop">Desktop</SelectItem>
                      <SelectItem value="server">Server</SelectItem>
                      <SelectItem value="printer">Printer</SelectItem>
                      <SelectItem value="network">Network device</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-bold">Serial number</Label>
                  <Input value={form.device.serial_number} onChange={(e) => setD("serial_number", e.target.value)}
                         placeholder="Auto Device ID if blank" className="mt-1.5 font-mono"
                         data-testid="device-serial-input" />
                </div>
                <div>
                  <Label className="text-xs font-bold">Warranty status</Label>
                  <Select value={form.device.warranty_status} onValueChange={(v) => setD("warranty_status", v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.device.warranty_status === "active" && (
                  <div>
                    <Label className="text-xs font-bold">Warranty expiry</Label>
                    <Input type="date" value={form.device.warranty_expiry}
                           onChange={(e) => setD("warranty_expiry", e.target.value)} className="mt-1.5" />
                  </div>
                )}
                <div>
                  <Label className="text-xs font-bold">Product reference no.</Label>
                  <Input
                    value={form.product_reference_number}
                    onChange={(e) => setF("product_reference_number", e.target.value)}
                    placeholder="Optional"
                    className="mt-1.5 font-mono"
                    data-testid="product-ref-input"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold">OEM reference no.</Label>
                  <Input
                    value={form.oem_reference_number}
                    onChange={(e) => setF("oem_reference_number", e.target.value)}
                    placeholder="Optional"
                    className="mt-1.5 font-mono"
                    data-testid="oem-ref-input"
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6 rounded-md">
              <h3 className="font-bold text-navy mb-4 text-sm uppercase tracking-wider">Problem</h3>
              <Textarea
                value={form.issue_description}
                onChange={(e) => setF("issue_description", e.target.value)}
                placeholder="Describe the issue reported by the customer…"
                rows={5} required
                data-testid="problem-description-input"
              />

              {/* Photo attachments */}
              <div className="mt-4">
                <Label className="text-xs font-bold flex items-center gap-1.5 mb-2">
                  <Paperclip className="w-3.5 h-3.5" /> Attach photos (max 5)
                </Label>

                {/* Uploaded thumbnails */}
                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {photos.map((p, i) => (
                      <div key={i} className="relative group w-20 h-20 rounded-md overflow-hidden border border-slate-200 bg-slate-50">
                        <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute top-0.5 right-0.5 bg-white/90 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3 text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload button */}
                {photos.length < 5 && (
                  <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-slate-300 text-xs text-slate-500 hover:border-navy hover:text-navy transition-colors">
                    {uploading ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
                    ) : (
                      <><ImageIcon className="w-3.5 h-3.5" /> Add photos</>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handlePhotoUpload}
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>
            </Card>

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => nav(-1)}>Cancel</Button>
              <Button type="submit" disabled={saving}
                      className="bg-navy hover:bg-navy/90 text-white font-bold rounded-md"
                      data-testid="ticket-create-submit-btn">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> :
                 <><Save className="w-4 h-4 mr-2" /> Create ticket</>}
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}