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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "../../components/ui/dialog";
import { ArrowLeft, Save, Loader2, Building2, PlusCircle, AlertCircle, Paperclip, X, ImageIcon, Search, ChevronDown, Check } from "lucide-react";

export default function TicketCreate() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const makeDevice = () => ({
    brand: "", model: "", serial_number: "",
    device_name: "", device_type: "",
    warranty_status: "none", warranty_expiry: "",
    purchase_date: "",
  });
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companySearch, setCompanySearch] = useState("");
  const [companyOpen, setCompanyOpen] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    company_name: "", contact_person: "", phone: "", email: "",
    address: "", gst_number: "", city: "", state: "", pincode: "",
  });
  const [creatingCompany, setCreatingCompany] = useState(false);

  // Close company dropdown on outside click
  useEffect(() => {
    if (!companyOpen) return;
    const handler = (e) => {
      if (!e.target.closest("[data-company-dropdown]")) setCompanyOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [companyOpen]);

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
    current_address: "",
    devices: [makeDevice()],
  });
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setD = (idx, k, v) => setForm((f) => ({
    ...f,
    devices: f.devices.map((device, i) => (
      i === idx ? { ...device, [k]: v } : device
    )),
  }));
  const addDevice = () => setForm((f) => ({
    ...f,
    devices: [...f.devices, makeDevice()],
  }));
  const removeDevice = (idx) => setForm((f) => ({
    ...f,
    devices: f.devices.length <= 1
      ? f.devices
      : f.devices.filter((_, i) => i !== idx),
  }));

  useEffect(() => {
    api.get("/companies?status=active&page_size=500")
      .then(({ data }) => setCompanies(data.items || []))
      .catch(() => {});
  }, []);

  const createQuickCompany = async () => {
    const name = companyForm.company_name?.trim();
    if (!name) {
      toast.error("Company name is required");
      return;
    }
    setCreatingCompany(true);
    try {
      const payload = { company_name: name };
      if (companyForm.contact_person?.trim())
        payload.contact_person = companyForm.contact_person.trim();
      if (companyForm.phone?.trim())
        payload.phone = companyForm.phone.trim();
      if (companyForm.email?.trim()) {
        const email = companyForm.email.trim();
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          payload.email = email;
        }
      }
      if (companyForm.address?.trim())
        payload.address = companyForm.address.trim();
      if (companyForm.gst_number?.trim())
        payload.gst_number = companyForm.gst_number.trim();
      if (companyForm.city?.trim())
        payload.city = companyForm.city.trim();
      if (companyForm.state?.trim())
        payload.state = companyForm.state.trim();
      if (companyForm.pincode?.trim())
        payload.pincode = companyForm.pincode.trim();

      const { data } = await api.post("/companies", payload);
      setCompanies((prev) => [...prev, data]);
      setF("company_id", data.id);
      setSelectedCompany(data);
      setShowCompanyModal(false);
      setCompanyForm({
        company_name: "", contact_person: "", phone: "", email: "",
        address: "", gst_number: "", city: "", state: "", pincode: "",
      });
      toast.success(`Company ${data.company_code} created`);
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || "Failed to create company";
      toast.error(errorMsg);
      console.error("Company creation error:", { status: err.response?.status, detail: err.response?.data?.detail, error: err });
    } finally {
      setCreatingCompany(false);
    }
  };

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
    if (!form.current_address?.trim()) return toast.error("Please enter the current address");
    setSaving(true);
    try {
      const devices = form.devices.map((device) => ({
        ...device,
        brand: device.brand.trim(),
        model: device.model.trim(),
        serial_number: device.serial_number?.trim() || null,
        warranty_expiry: device.warranty_expiry || null,
        purchase_date: device.purchase_date || null,
      }));
      if (devices.some((device) => !device.brand || !device.model)) {
        setSaving(false);
        return toast.error("Brand and model are required for every device");
      }
      const ticketFields = { ...form };
      delete ticketFields.devices;
      const payload = {
        photos: photos.map((p) => p.url),
        ...ticketFields,
        product_reference_number: form.product_reference_number?.trim() || null,
        oem_reference_number: form.oem_reference_number?.trim() || null,
        current_address: form.current_address?.trim() || null,
        device: devices[0],
        devices,
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
              <div className="text-xs text-slate-500 mt-1">Create a company to get started.</div>
              <Button type="button" onClick={() => setShowCompanyModal(true)}
                      className="mt-3 bg-navy hover:bg-navy/90 text-white">
                <PlusCircle className="w-4 h-4 mr-2" /> Create company
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label className="text-xs font-bold">Select company *</Label>
                <div className="relative mt-1.5" data-company-dropdown>
                  <button
                    type="button"
                    onClick={() => { setCompanyOpen((o) => !o); setCompanySearch(""); }}
                    className="w-full h-11 px-3 flex items-center justify-between rounded-md border border-slate-200 bg-white text-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-navy/20"
                    data-testid="company-select"
                  >
                    {selectedCompany ? (
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">{selectedCompany.company_code}</span>
                        <span>{selectedCompany.company_name}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">Choose a company…</span>
                    )}
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>

                  {companyOpen && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg">
                      <div className="p-2 border-b border-slate-100">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input
                            autoFocus
                            type="text"
                            value={companySearch}
                            onChange={(e) => setCompanySearch(e.target.value)}
                            placeholder="Search company…"
                            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-navy/20"
                          />
                        </div>
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        {companies
                          .filter((c) =>
                            !companySearch ||
                            c.company_name.toLowerCase().includes(companySearch.toLowerCase()) ||
                            c.company_code.toLowerCase().includes(companySearch.toLowerCase())
                          )
                          .map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setF("company_id", c.id);
                                setCompanyOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between hover:bg-slate-50 ${
                                form.company_id === c.id ? "bg-blue-50 text-navy" : ""
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span className="font-mono text-xs text-slate-400">{c.company_code}</span>
                                <span className="font-medium">{c.company_name}</span>
                              </span>
                              {form.company_id === c.id && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                            </button>
                          ))}
                        {companies.filter((c) =>
                          !companySearch ||
                          c.company_name.toLowerCase().includes(companySearch.toLowerCase()) ||
                          c.company_code.toLowerCase().includes(companySearch.toLowerCase())
                        ).length === 0 && (
                          <div className="px-3 py-4 text-sm text-slate-400 text-center">No companies found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
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
              <h3 className="font-bold text-navy mb-4 text-sm uppercase tracking-wider">Service address</h3>
              <div>
                <Label className="text-xs font-bold">Current address *</Label>
                <Textarea
                  value={form.current_address}
                  onChange={(e) => setF("current_address", e.target.value)}
                  placeholder="Enter the address where the service needs to be provided…"
                  rows={3}
                  required
                  className="mt-1.5"
                  data-testid="current-address-input"
                />
              </div>
            </Card>

            <Card className="p-6 rounded-md">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-bold text-navy text-sm uppercase tracking-wider">
                  Devices ({form.devices.length})
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addDevice}
                  className="h-9 rounded-md"
                  data-testid="add-device-btn"
                  aria-label="Add another device"
                >
                  <PlusCircle className="w-4 h-4 mr-2" /> Add device
                </Button>
              </div>
              <div className="space-y-5">
                {form.devices.map((device, idx) => (
                  <div key={idx} className={idx > 0 ? "pt-5 border-t border-slate-200" : ""}>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Device {idx + 1}
                      </div>
                      {form.devices.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeDevice(idx)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700"
                          aria-label={`Remove device ${idx + 1}`}
                        >
                          <X className="w-3.5 h-3.5" /> Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-bold">Brand *</Label>
                        <Input value={device.brand} onChange={(e) => setD(idx, "brand", e.target.value)} required
                               placeholder="Dell / HP / Apple…" className="mt-1.5"
                               data-testid={idx === 0 ? "device-brand-input" : `device-brand-input-${idx}`} />
                      </div>
                      <div>
                        <Label className="text-xs font-bold">Model *</Label>
                        <Input value={device.model} onChange={(e) => setD(idx, "model", e.target.value)} required
                               placeholder="Latitude 5420" className="mt-1.5"
                               data-testid={idx === 0 ? "device-model-input" : `device-model-input-${idx}`} />
                      </div>
                      <div>
                        <Label className="text-xs font-bold">Device type</Label>
                        <Select value={device.device_type || ""} onValueChange={(v) => setD(idx, "device_type", v)}>
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
                        <Input value={device.serial_number} onChange={(e) => setD(idx, "serial_number", e.target.value)}
                               placeholder="Auto Device ID if blank" className="mt-1.5 font-mono"
                               data-testid={idx === 0 ? "device-serial-input" : `device-serial-input-${idx}`} />
                      </div>
                      <div>
                        <Label className="text-xs font-bold">Warranty status</Label>
                        <Select value={device.warranty_status} onValueChange={(v) => setD(idx, "warranty_status", v)}>
                          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                            <SelectItem value="none">None</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {device.warranty_status === "active" && (
                        <div>
                          <Label className="text-xs font-bold">Warranty expiry</Label>
                          <Input type="date" value={device.warranty_expiry}
                                 onChange={(e) => setD(idx, "warranty_expiry", e.target.value)} className="mt-1.5" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 pt-5 border-t border-slate-200">
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

      <Dialog open={showCompanyModal} onOpenChange={setShowCompanyModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create new company</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="sm:col-span-2">
              <Label className="text-xs font-bold">Company name *</Label>
              <Input
                value={companyForm.company_name}
                onChange={(e) => setCompanyForm({...companyForm, company_name: e.target.value})}
                placeholder="Enter company name"
                className="mt-1"
                data-testid="quick-company-name-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">Contact person</Label>
                <Input
                  value={companyForm.contact_person}
                  onChange={(e) => setCompanyForm({...companyForm, contact_person: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-bold">Phone</Label>
                <Input
                  value={companyForm.phone}
                  onChange={(e) => setCompanyForm({...companyForm, phone: e.target.value})}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold">Email</Label>
              <Input type="email" value={companyForm.email}
                     onChange={(e) => setCompanyForm({...companyForm, email: e.target.value})}
                     className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-bold">Address</Label>
              <Textarea rows={2} value={companyForm.address}
                        onChange={(e) => setCompanyForm({...companyForm, address: e.target.value})}
                        className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">City</Label>
                <Input value={companyForm.city}
                       onChange={(e) => setCompanyForm({...companyForm, city: e.target.value})}
                       className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-bold">State</Label>
                <Input value={companyForm.state}
                       onChange={(e) => setCompanyForm({...companyForm, state: e.target.value})}
                       className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">GST number</Label>
                <Input value={companyForm.gst_number}
                       onChange={(e) => setCompanyForm({...companyForm, gst_number: e.target.value})}
                       className="mt-1 font-mono uppercase" />
              </div>
              <div>
                <Label className="text-xs font-bold">Pincode</Label>
                <Input value={companyForm.pincode}
                       onChange={(e) => setCompanyForm({...companyForm, pincode: e.target.value})}
                       className="mt-1 font-mono" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompanyModal(false)}>Cancel</Button>
            <Button onClick={createQuickCompany} disabled={creatingCompany}
                    className="bg-navy hover:bg-navy/90 text-white">
              {creatingCompany ? <Loader2 className="w-4 h-4 animate-spin" /> :
               <><Building2 className="w-4 h-4 mr-2" /> Create company</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
