import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Power, Trash2, X } from "lucide-react";
import { api, formatError } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "../../components/ui/dialog";

export default function EngineersPage() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", password: "", skills: "",
  });

  const load = async () => {
    try { const { data } = await api.get("/engineers"); setList(data); } catch {}
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", email: "", phone: "", password: "", skills: "" });
    setOpen(true);
  };

  const openEdit = (e) => {
    setEditing(e);
    setForm({
      name: e.name || "", email: e.email, phone: e.phone || "",
      password: "", skills: (e.skills || []).join(", "),
    });
    setOpen(true);
  };

  const save = async () => {
    try {
      const skillsArr = form.skills.split(",").map((s) => s.trim()).filter(Boolean);
      if (editing) {
        const payload = {
          name: form.name, phone: form.phone, skills: skillsArr,
        };
        if (form.password) payload.password = form.password;
        await api.patch(`/engineers/${editing.id}`, payload);
        toast.success("Engineer updated");
      } else {
        await api.post("/engineers", {
          name: form.name, email: form.email, phone: form.phone,
          password: form.password, skills: skillsArr,
        });
        toast.success("Engineer created");
      }
      setOpen(false);
      load();
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail));
    }
  };

  const toggleActive = async (e) => {
    await api.patch(`/engineers/${e.id}`, { is_active: !e.is_active });
    load();
  };

  const toggleAvailable = async (e) => {
    await api.patch(`/engineers/${e.id}`, { is_available: !e.is_available });
    load();
  };

  const remove = async (e) => {
    if (!window.confirm(`Remove ${e.name}?`)) return;
    await api.delete(`/engineers/${e.id}`);
    toast.success("Engineer removed");
    load();
  };

  return (
    <div className="space-y-6" data-testid="engineers-page">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Team</div>
          <h1 className="font-display font-black text-3xl tracking-tight text-navy">Engineers</h1>
        </div>
        <Button onClick={openNew} className="bg-navy hover:bg-navy/90 text-white rounded-md"
                data-testid="add-engineer-btn">
          <Plus className="w-4 h-4 mr-2" /> Add engineer
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((e) => (
          <Card key={e.id} className="p-5 rounded-md hover-lift" data-testid={`engineer-card-${e.id}`}>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-navy text-white grid place-items-center font-bold">
                {e.name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-navy truncate">{e.name}</div>
                  {e.is_available && e.is_active && <span className="pulse-dot" />}
                </div>
                <div className="text-xs text-slate-500 truncate">{e.email}</div>
                <div className="text-xs text-slate-500">{e.phone || "—"}</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {(e.skills || []).map((s) => (
                <span key={s} className="text-[10px] uppercase font-bold tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                  {s}
                </span>
              ))}
              {(!e.skills || e.skills.length === 0) && (
                <span className="text-xs text-slate-400">No skills set</span>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-slate-50">
                <span className="text-slate-600">Active</span>
                <Switch checked={!!e.is_active} onCheckedChange={() => toggleActive(e)} />
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-50">
                <span className="text-slate-600">Available</span>
                <Switch checked={!!e.is_available} onCheckedChange={() => toggleAvailable(e)} />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <div className="text-slate-500">
                <span className="font-mono font-bold text-navy">{e.active_tickets || 0}</span> active tickets
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(e)} className="p-1.5 rounded hover:bg-slate-100" title="Edit">
                  <Pencil className="w-3.5 h-3.5 text-slate-600" />
                </button>
                <button onClick={() => remove(e)} className="p-1.5 rounded hover:bg-red-50" title="Remove">
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit engineer" : "Add new engineer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-bold">Name</Label>
              <Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})}
                     data-testid="eng-name-input" />
            </div>
            <div>
              <Label className="text-xs font-bold">Email</Label>
              <Input type="email" value={form.email} disabled={!!editing}
                     onChange={(e) => setForm({...form, email: e.target.value})}
                     data-testid="eng-email-input" />
            </div>
            <div>
              <Label className="text-xs font-bold">Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} />
            </div>
            <div>
              <Label className="text-xs font-bold">{editing ? "New password (leave blank to keep)" : "Password"}</Label>
              <Input type="password" value={form.password}
                     onChange={(e) => setForm({...form, password: e.target.value})}
                     data-testid="eng-password-input" />
            </div>
            <div>
              <Label className="text-xs font-bold">Skills (comma separated)</Label>
              <Input value={form.skills} onChange={(e) => setForm({...form, skills: e.target.value})}
                     placeholder="Laptop Repair, Networking, Printer" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} className="bg-navy hover:bg-navy/90" data-testid="save-engineer-btn">
              {editing ? "Save changes" : "Create engineer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
