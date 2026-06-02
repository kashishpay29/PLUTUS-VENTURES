import React, { useCallback, useEffect, useState } from "react";
import { Edit2, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";

const EMPTY = { name: "", email: "", password: "", phone: "", designation: "" };

export default function TicketAdminsPage() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/ticket-admins");
      setList(Array.isArray(data) ? data : data.items || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to load ticket admins");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name || "",
      email: item.email || "",
      password: "",
      phone: item.phone || "",
      designation: item.designation || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name || !form.email || (!editing && !form.password)) {
      toast.error("Name, email and password are required");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (editing && !payload.password) delete payload.password;
      if (editing) {
        await api.patch(`/ticket-admins/${editing.id}`, payload);
        toast.success("Ticket admin updated");
      } else {
        await api.post("/ticket-admins", payload);
        toast.success("Ticket admin created");
      }
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete ticket admin ${item.name}?`)) return;
    try {
      await api.delete(`/ticket-admins/${item.id}`);
      toast.success("Ticket admin deleted");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete");
    }
  };

  return (
    <div className="space-y-6" data-testid="ticket-admins-page">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Team</div>
          <h1 className="font-display font-black text-3xl tracking-tight text-navy">Ticket Admins</h1>
          <p className="text-slate-500 text-sm mt-1">
            Limited users who can create tickets, view active tickets, reassign engineers, and view device history.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-navy hover:bg-navy/90 text-white font-semibold rounded-md h-11"
          data-testid="add-ticket-admin-btn"
        >
          <PlusCircle className="w-4 h-4 mr-2" /> Add Ticket Admin
        </Button>
      </div>

      <Card className="rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-[10px] uppercase tracking-[0.15em] text-slate-500">
              <th className="p-3 font-bold">Name</th>
              <th className="p-3 font-bold">Email</th>
              <th className="p-3 font-bold">Phone</th>
              <th className="p-3 font-bold">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-3">
                  <div className="font-semibold text-navy">{item.name}</div>
                  <div className="text-xs text-slate-500">{item.designation || "Ticket Admin"}</div>
                </td>
                <td className="p-3 text-slate-500">{item.email}</td>
                <td className="p-3 text-slate-500">{item.phone || "—"}</td>
                <td className="p-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                    item.is_active !== false ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                  }`}>
                    {item.is_active !== false ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-slate-100">
                      <Edit2 className="w-4 h-4 text-slate-500" />
                    </button>
                    <button onClick={() => remove(item)} className="p-1.5 rounded hover:bg-red-50">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  No ticket admins yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Ticket Admin" : "Create Ticket Admin"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-bold">Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold">Email *</Label>
              <Input
                type="email"
                value={form.email}
                disabled={!!editing}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-bold">Designation</Label>
              <Input
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
                placeholder="Ticket Admin"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-bold">{editing ? "New password (leave blank to keep)" : "Password *"}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="mt-1"
              />
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
