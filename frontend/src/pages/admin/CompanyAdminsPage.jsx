import React, { useState, useEffect } from "react";
import { api, formatError } from "../../lib/api";
import { toast } from "sonner";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { Plus, Trash2, Building2 } from "lucide-react";

export default function CompanyAdminsPage() {
  const [admins, setAdmins] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", password: "",
    company_id: "", designation: "", can_assign_engineers: false,
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [ar, cr] = await Promise.all([
        api.get("/company-admins"),
        api.get("/companies", { params: { page_size: 200 } }),
      ]);
      setAdmins(ar.data.items || []);
      setCompanies(cr.data.items || []);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name || !form.email || !form.password || !form.company_id) {
      return toast.error("Fill in all required fields");
    }
    setSaving(true);
    try {
      await api.post("/company-admins", form);
      toast.success("Company admin created");
      setOpen(false);
      setForm({ name: "", email: "", phone: "", password: "", company_id: "", designation: "", can_assign_engineers: false });
      load();
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this company admin?")) return;
    try {
      await api.delete(`/company-admins/${id}`);
      toast.success("Deleted");
      load();
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Management</div>
          <h1 className="font-display font-black text-3xl tracking-tight text-navy mt-1">Company Admins</h1>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-navy hover:bg-navy/90 text-white font-semibold rounded-md">
          <Plus className="w-4 h-4 mr-2" /> Add Company Admin
        </Button>
      </div>

      <Card className="rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-[10px] uppercase tracking-[0.15em] text-slate-500">
              <th className="p-3 font-bold">Name</th>
              <th className="p-3 font-bold">Email</th>
              <th className="p-3 font-bold">Company</th>
              <th className="p-3 font-bold">Can Assign Engineers</th>
              <th className="p-3 font-bold">Status</th>
              <th className="p-3 font-bold"></th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-3 font-semibold text-navy">{a.name}</td>
                <td className="p-3 text-slate-600">{a.email}</td>
                <td className="p-3">
                  <span className="flex items-center gap-1 text-slate-700">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {a.company_name}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full ${
                    a.can_assign_engineers ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}>
                    {a.can_assign_engineers ? "Yes" : "No"}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full ${
                    a.is_active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  }`}>
                    {a.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="p-3">
                  <button onClick={() => remove(a.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {admins.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">No company admins yet</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Company Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {[
              { id: "name", label: "Name *", placeholder: "Full name" },
              { id: "email", label: "Email *", placeholder: "email@company.com", type: "email" },
              { id: "phone", label: "Phone", placeholder: "+91 …" },
              { id: "password", label: "Password *", placeholder: "Min 8 chars", type: "password" },
              { id: "designation", label: "Designation", placeholder: "e.g. IT Manager" },
            ].map(({ id, label, placeholder, type = "text" }) => (
              <div key={id}>
                <Label className="text-xs font-bold">{label}</Label>
                <Input
                  type={type}
                  className="mt-1"
                  placeholder={placeholder}
                  value={form[id]}
                  onChange={(e) => setForm({ ...form, [id]: e.target.value })}
                />
              </div>
            ))}
            <div>
              <Label className="text-xs font-bold">Company *</Label>
              <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select company…" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="can_assign"
                checked={form.can_assign_engineers}
                onChange={(e) => setForm({ ...form, can_assign_engineers: e.target.checked })}
              />
              <label htmlFor="can_assign" className="text-sm">Can assign engineers to tickets</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving} className="bg-navy hover:bg-navy/90 text-white">
              {saving ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
