import React, { useState } from "react";
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
  const nav = useNavigate();
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

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
            <div className="sm:col-span-2">
              <Label className="text-xs font-bold">Company name *</Label>
              <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)}
                     required className="mt-1.5" data-testid="company-name-input" />
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
