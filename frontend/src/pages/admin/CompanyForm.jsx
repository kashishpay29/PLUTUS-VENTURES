import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Save, Loader2, Building2 } from "lucide-react";
import { api, formatError } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";

const EMPTY = {
  company_name: "", contact_person: "", phone: "", email: "",
  address: "", gst_number: "", city: "", state: "", pincode: "",
};

export default function CompanyForm({ initial, isEdit, onSaved }) {
  const [form, setForm] = useState(initial || EMPTY);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allCompanies, setAllCompanies] = useState([]);
  const suggestRef = useRef(null);
  const nav = useNavigate();
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Load all companies once for autocomplete
  useEffect(() => {
    api.get("/companies?page_size=500").then(({ data }) => {
      const list = Array.isArray(data) ? data : data.items || data.companies || [];
      setAllCompanies(list);
    }).catch(() => {});

    // Close suggestions on outside click
    const handler = (e) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const onNameChange = (val) => {
    set("company_name", val);
    if (val.trim().length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    const filtered = allCompanies.filter((c) =>
      (c.company_name || c.name || "").toLowerCase().includes(val.toLowerCase())
    ).slice(0, 8);
    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  };

  const selectSuggestion = (c) => {
    setForm((f) => ({
      ...f,
      company_name: c.company_name || c.name || "",
      contact_person: c.contact_person || f.contact_person,
      phone: c.phone || f.phone,
      email: c.email || f.email,
      address: c.address || f.address,
      gst_number: c.gst_number || f.gst_number,
      city: c.city || f.city,
      state: c.state || f.state,
      pincode: c.pincode || f.pincode,
    }));
    setShowSuggestions(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.company_name.trim()) return toast.error("Company name is required");
    setSaving(true);
    try {
      const payload = { ...form };
      Object.keys(payload).forEach((k) => { if (payload[k] === "") delete payload[k]; });
      const { data } = isEdit
        ? await api.put(`/companies/${initial.id}`, payload)
        : await api.post("/companies", payload);
      toast.success(isEdit ? "Company updated" : `Company ${data.company_code} created`);
      if (onSaved) onSaved(data);
      else nav(`/admin/companies/${data.id}`);
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail));
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-3xl space-y-6" data-testid="company-form">
      <button onClick={() => nav(-1)} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-navy uppercase tracking-wider">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Companies</div>
        <h1 className="font-display font-black text-3xl tracking-tight text-navy flex items-center gap-2">
          <Building2 className="w-6 h-6 text-signal" />
          {isEdit ? "Edit company" : "New company"}
        </h1>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <Card className="p-6 rounded-md">
          <h3 className="font-bold text-navy mb-4 text-sm uppercase tracking-wider">Company details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 relative" ref={suggestRef}>
              <Label className="text-xs font-bold">Company name *</Label>
              <Input
                value={form.company_name}
                onChange={(e) => onNameChange(e.target.value)}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                required className="mt-1.5" data-testid="company-name-input"
                placeholder="Start typing to search existing companies…"
                autoComplete="off"
              />
              {showSuggestions && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden">
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-bold bg-slate-50 border-b">
                    Existing companies — click to use
                  </div>
                  {suggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectSuggestion(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between group border-b border-slate-50 last:border-0"
                    >
                      <span className="font-semibold text-navy">{c.company_name || c.name}</span>
                      <span className="text-xs text-slate-400 group-hover:text-blue-500 font-mono">{c.company_code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs font-bold">Contact person</Label>
              <Input value={form.contact_person || ""} onChange={(e) => set("contact_person", e.target.value)}
                     className="mt-1.5" data-testid="company-contact-input" />
            </div>
            <div>
              <Label className="text-xs font-bold">Phone</Label>
              <Input value={form.phone || ""} onChange={(e) => set("phone", e.target.value)}
                     className="mt-1.5" data-testid="company-phone-input" />
            </div>
            <div>
              <Label className="text-xs font-bold">Email</Label>
              <Input type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)}
                     className="mt-1.5" data-testid="company-email-input" />
            </div>
            <div>
              <Label className="text-xs font-bold">GST number</Label>
              <Input value={form.gst_number || ""} onChange={(e) => set("gst_number", e.target.value)}
                     className="mt-1.5 font-mono uppercase" data-testid="company-gst-input" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs font-bold">Address</Label>
              <Textarea rows={2} value={form.address || ""} onChange={(e) => set("address", e.target.value)}
                        className="mt-1.5" data-testid="company-address-input" />
            </div>
            <div>
              <Label className="text-xs font-bold">City</Label>
              <Input value={form.city || ""} onChange={(e) => set("city", e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-xs font-bold">State</Label>
              <Input value={form.state || ""} onChange={(e) => set("state", e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-xs font-bold">Pincode</Label>
              <Input value={form.pincode || ""} onChange={(e) => set("pincode", e.target.value)} className="mt-1.5 font-mono" />
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => nav(-1)}>Cancel</Button>
          <Button type="submit" disabled={saving}
                  className="bg-navy hover:bg-navy/90 text-white font-bold rounded-md"
                  data-testid="company-save-btn">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> :
             <><Save className="w-4 h-4 mr-2" /> {isEdit ? "Save changes" : "Create company"}</>}
          </Button>
        </div>
      </form>
    </div>
  );
}