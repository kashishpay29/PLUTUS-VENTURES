import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Plus, Search, Building2, Pencil, Trash2, MapPin, Phone, Mail,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { api, formatError } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "../../components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "../../components/ui/alert-dialog";

export default function CompaniesPage() {
  const [data, setData] = useState({ items: [], total: 0 });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [delTarget, setDelTarget] = useState(null);
  const nav = useNavigate();

  const load = async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status !== "all") params.set("status", status);
    params.set("page", page);
    params.set("page_size", pageSize);
    try {
      const { data } = await api.get(`/companies?${params}`);
      setData(data);
    } catch {}
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q, status, page]);

  const confirmDelete = async () => {
    try {
      await api.delete(`/companies/${delTarget.id}`);
      toast.success("Company deleted");
      setDelTarget(null);
      load();
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail));
      setDelTarget(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  return (
    <div className="space-y-6" data-testid="companies-page">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Customers</div>
          <h1 className="font-display font-black text-3xl tracking-tight text-navy">Companies</h1>
          <p className="text-slate-500 text-sm mt-1">
            <span className="font-mono font-bold text-navy">{data.total}</span> companies on file
          </p>
        </div>
        <Link to="/admin/companies/new">
          <Button className="bg-navy hover:bg-navy/90 text-white rounded-md h-11" data-testid="add-company-btn">
            <Plus className="w-4 h-4 mr-2" /> Add Company
          </Button>
        </Link>
      </div>

      <Card className="p-4 rounded-md">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Search by name, code, contact, GST, city…"
              className="pl-9 h-11"
              data-testid="company-search-input"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-44 h-11" data-testid="company-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-[10px] uppercase tracking-[0.15em] text-slate-500">
              <th className="p-3 font-bold">Company</th>
              <th className="p-3 font-bold">Code</th>
              <th className="p-3 font-bold">Contact</th>
              <th className="p-3 font-bold hidden md:table-cell">Location</th>
              <th className="p-3 font-bold">GST</th>
              <th className="p-3 font-bold">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((c) => (
              <tr
                key={c.id}
                onClick={() => nav(`/admin/companies/${c.id}`)}
                className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                data-testid={`company-row-${c.company_code}`}
              >
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-navy/5 grid place-items-center">
                      <Building2 className="w-4 h-4 text-navy" />
                    </div>
                    <div>
                      <div className="font-semibold text-navy">{c.company_name}</div>
                      <div className="text-xs text-slate-500">{c.email || "—"}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3 font-mono text-xs font-bold text-signal">{c.company_code}</td>
                <td className="p-3">
                  <div className="font-medium">{c.contact_person || "—"}</div>
                  <div className="text-xs text-slate-500">{c.phone || "—"}</div>
                </td>
                <td className="p-3 hidden md:table-cell text-slate-600 text-xs">
                  {c.city || c.state ? `${c.city || ""}${c.city && c.state ? ", " : ""}${c.state || ""}` : "—"}
                </td>
                <td className="p-3 font-mono text-xs text-slate-600">{c.gst_number || "—"}</td>
                <td className="p-3">
                  <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                    c.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${c.status === "active" ? "bg-emerald-500" : "bg-slate-400"}`} />
                    {c.status}
                  </span>
                </td>
                <td className="p-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <Link to={`/admin/companies/${c.id}`}
                          className="p-1.5 rounded hover:bg-slate-100"
                          title="View / Edit"
                          data-testid={`company-edit-${c.company_code}`}>
                      <Pencil className="w-3.5 h-3.5 text-slate-600" />
                    </Link>
                    <button onClick={() => setDelTarget(c)}
                            className="p-1.5 rounded hover:bg-red-50"
                            title="Delete"
                            data-testid={`company-delete-${c.company_code}`}>
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr><td colSpan={7} className="p-12 text-center text-slate-500">
                <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <div>No companies found</div>
                <Link to="/admin/companies/new" className="text-signal text-sm font-bold mt-2 inline-block">
                  + Add your first company
                </Link>
              </td></tr>
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t border-slate-200 bg-slate-50">
            <div className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-1">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                      className="p-2 rounded hover:bg-white disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
                      className="p-2 rounded hover:bg-white disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      <AlertDialog open={!!delTarget} onOpenChange={(v) => !v && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this company?</AlertDialogTitle>
            <AlertDialogDescription>
              <b>{delTarget?.company_name}</b> ({delTarget?.company_code}) will be removed.
              Companies with active tickets cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}
                              className="bg-red-600 hover:bg-red-700"
                              data-testid="confirm-delete-company-btn">
              Delete company
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
