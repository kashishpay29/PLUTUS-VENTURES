import React, { useEffect, useState, useCallback } from "react";
import { Users, PlusCircle, Trash2, Edit2, X, Check } from "lucide-react";
import { api } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { toast } from "sonner";

const EMPTY = { name: "", email: "", password: "", phone: "", assigned_company_ids: [], assigned_engineer_ids: [] };

export default function SubAdminsPage() {
  const [list, setList] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sa, co, en] = await Promise.all([
        api.get("/sub-admins"),
        api.get("/companies"),
        api.get("/engineers"),
      ]);
      setList(sa.data);
      setCompanies(Array.isArray(co.data) ? co.data : co.data.companies || []);
      setEngineers(en.data);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (s) => {
    setEditing(s);
    setForm({ name: s.name, email: s.email, password: "", phone: s.phone || "",
               assigned_company_ids: s.assigned_company_ids || [],
               assigned_engineer_ids: s.assigned_engineer_ids || [] });
    setOpen(true);
  };

  const toggleId = (field, id) => {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(id) ? f[field].filter((x) => x !== id) : [...f[field], id],
    }));
  };

  const save = async () => {
    if (!form.name || !form.email || (!editing && !form.password)) {
      toast.error("Name, email and password are required"); return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (editing && !payload.password) delete payload.password;
      if (editing) {
        await api.patch(`/sub-admins/${editing.id}`, payload);
        toast.success("Sub-admin updated");
      } else {
        await api.post("/sub-admins", payload);
        toast.success("Sub-admin created");
      }
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save");
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this sub-admin?")) return;
    try {
      await api.delete(`/sub-admins/${id}`);
      toast.success("Deleted");
      load();
    } catch { toast.error("Failed to delete"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Team</div>
          <h1 className="font-display font-black text-3xl tracking-tight text-navy">Sub-Admins</h1>
          <p className="text-slate-500 text-sm mt-1">Manage sub-admins and their company/engineer access.</p>
        </div>
        <Button onClick={openCreate} className="bg-navy hover:bg-navy/90 text-white font-semibold rounded-md h-11">
          <PlusCircle className="w-4 h-4 mr-2" /> Add Sub-Admin
        </Button>
      </div>

      <Card className="rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-[10px] uppercase tracking-[0.15em] text-slate-500">
              <th className="p-3 font-bold">Name</th>
              <th className="p-3 font-bold">Email</th>
              <th className="p-3 font-bold">Companies</th>
              <th className="p-3 font-bold">Engineers</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-3 font-semibold text-navy">{s.name}</td>
                <td className="p-3 text-slate-500">{s.email}</td>
                <td className="p-3 text-slate-500">{(s.assigned_company_ids || []).length} companies</td>
                <td className="p-3 text-slate-500">{(s.assigned_engineer_ids || []).length} engineers</td>
                <td className="p-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-slate-100">
                      <Edit2 className="w-4 h-4 text-slate-500" />
                    </button>
                    <button onClick={() => remove(s.id)} className="p-1.5 rounded hover:bg-red-50">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-slate-500">No sub-admins yet</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Sub-Admin" : "Create Sub-Admin"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-bold">Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold">Email *</Label>
              <Input type="email" value={form.email} disabled={!!editing}
                     onChange={(e) => setForm({...form, email: e.target.value})} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-bold">{editing ? "New Password (leave blank to keep)" : "Password *"}</Label>
              <Input type="password" value={form.password}
                     onChange={(e) => setForm({...form, password: e.target.value})} className="mt-1" />
            </div>

            <div>
              <Label className="text-xs font-bold mb-2 block">Assign Companies</Label>
              <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                {companies.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-slate-50 rounded">
                    <input type="checkbox" checked={form.assigned_company_ids.includes(c.id)}
                           onChange={() => toggleId("assigned_company_ids", c.id)} />
                    <span className="text-sm">{c.name}</span>
                  </label>
                ))}
                {companies.length === 0 && <div className="text-xs text-slate-500 p-2">No companies found</div>}
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold mb-2 block">Assign Engineers</Label>
              <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                {engineers.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-slate-50 rounded">
                    <input type="checkbox" checked={form.assigned_engineer_ids.includes(e.id)}
                           onChange={() => toggleId("assigned_engineer_ids", e.id)} />
                    <span className="text-sm">{e.name} <span className="text-slate-400 text-xs">{e.email}</span></span>
                  </label>
                ))}
                {engineers.length === 0 && <div className="text-xs text-slate-500 p-2">No engineers found</div>}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving} className="bg-navy hover:bg-navy/90 text-white">
                {saving ? "Saving…" : editing ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
