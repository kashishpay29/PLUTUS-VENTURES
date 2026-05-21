import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  History, Download, Filter, RotateCcw, Trash2, ArchiveRestore,
  ChevronLeft, ChevronRight, Search,
} from "lucide-react";
import { api, formatError } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { StatusBadge } from "../../lib/status";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { toast } from "sonner";

const PAGE_SIZE = 10;

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

export default function DeviceHistoryPage() {
  // Filters (default: last 30 days)
  const [company, setCompany] = useState("");
  const [startDate, setStartDate] = useState(isoDaysAgo(30));
  const [endDate, setEndDate] = useState(isoToday());

  // Local search across the loaded rows
  const [search, setSearch] = useState("");

  // Data
  const [showDeleted, setShowDeleted] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);

  // Delete confirmation
  const [confirmRow, setConfirmRow] = useState(null);

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    if (company.trim()) p.set("company", company.trim());
    if (startDate) p.set("start_date", startDate);
    if (endDate) p.set("end_date", endDate);
    return p;
  }, [company, startDate, endDate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      if (showDeleted) params.set("only_deleted", "1");
      const { data } = await api.get(`/device-history/filter?${params.toString()}`);
      const items = (data.items || []).map((r) => ({ ...r, _deleted: !!r.is_deleted }));
      setRows(items);
      setPage(1);
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail) || "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [buildParams, showDeleted]);

  useEffect(() => { load(); }, [showDeleted]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetFilters = () => {
    setCompany("");
    setStartDate(isoDaysAgo(30));
    setEndDate(isoToday());
    setSearch("");
    setShowDeleted(false);
    setTimeout(load, 0);
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const params = buildParams();
      // The /export endpoint is auth-gated; use fetch with header.
      const token = localStorage.getItem("token");
      const url = `${process.env.REACT_APP_BACKEND_URL}/api/device-history/export?${params.toString()}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.text()) || "Export failed");
      const blob = await res.blob();
      const dispo = res.headers.get("content-disposition") || "";
      const fnameMatch = dispo.match(/filename="?([^"]+)"?/i);
      const filename = fnameMatch?.[1] || "device_history.xlsx";
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(dlUrl);
      toast.success("Excel exported");
    } catch (err) {
      toast.error(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const performDelete = async () => {
    if (!confirmRow) return;
    const row = confirmRow;
    setConfirmRow(null);
    try {
      await api.delete(`/device-history/${row.id}`);
      toast.success(`Deleted ${row.ticket_id}`);
      // Optimistic: remove from rows
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail) || "Delete failed");
    }
  };

  const restore = async (row) => {
    try {
      await api.post(`/device-history/${row.id}/restore`);
      toast.success(`Restored ${row.ticket_id}`);
      load();
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail) || "Restore failed");
    }
  };

  // Client-side search across loaded rows
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      [
        r.device_id, r.ticket_id, r.company_name, r.engineer_name,
        r.status, r.product_reference_number, r.oem_reference_number,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term))
    );
  }, [rows, search]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);

  return (
    <div className="space-y-6" data-testid="device-history-page">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Audit</div>
          <h1 className="font-display font-black text-3xl tracking-tight text-navy flex items-center gap-2">
            <History className="w-7 h-7 text-[#2563EB]" /> Device History
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Filter completed service history, export to Excel, and manage records.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={resetFilters}
            className="h-10 gap-2"
            data-testid="device-history-reset-btn"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </Button>
          <Button
            onClick={exportExcel}
            disabled={exporting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 gap-2"
            data-testid="device-history-export-btn"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Exporting…" : "Export to Excel"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-5 rounded-md">
        <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-4 flex items-center gap-2">
          <Filter className="w-3.5 h-3.5" /> Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <Label className="text-xs font-bold">Company name</Label>
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Partial match…"
              className="mt-1.5 h-10"
              data-testid="device-history-company-input"
            />
          </div>
          <div>
            <Label className="text-xs font-bold">Start date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1.5 h-10"
              data-testid="device-history-start-date"
            />
          </div>
          <div>
            <Label className="text-xs font-bold">End date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1.5 h-10"
              data-testid="device-history-end-date"
            />
          </div>
          <Button
            onClick={load}
            disabled={loading}
            className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white h-10 gap-2"
            data-testid="device-history-apply-btn"
          >
            <Filter className="w-4 h-4" />
            {loading ? "Loading…" : "Apply filters"}
          </Button>
        </div>
      </Card>

      {/* Search + result summary */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative max-w-sm w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search loaded results…"
              className="pl-9 h-10"
              data-testid="device-history-search-input"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none"
                 data-testid="device-history-show-deleted-label">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="rounded border-slate-300"
              data-testid="device-history-show-deleted-toggle"
            />
            Show deleted records
          </label>
        </div>
        <div className="text-xs text-slate-500" data-testid="device-history-summary">
          Showing <b>{pageRows.length}</b> of <b>{filtered.length}</b> records
          {rows.length !== filtered.length && (
            <> (filtered from {rows.length} total)</>
          )}
        </div>
      </div>

      {/* Table */}
      <Card className="rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="device-history-table">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-[10px] uppercase tracking-[0.15em] text-slate-500">
                <th className="p-3 font-bold">Device ID</th>
                <th className="p-3 font-bold">Ticket ID</th>
                <th className="p-3 font-bold">Company</th>
                <th className="p-3 font-bold">Engineer</th>
                <th className="p-3 font-bold">Status</th>
                <th className="p-3 font-bold">Created</th>
                <th className="p-3 font-bold">Closed</th>
                <th className="p-3 font-bold">Product Ref #</th>
                <th className="p-3 font-bold">OEM Ref #</th>
                <th className="p-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                  data-testid={`device-history-row-${r.id}`}
                >
                  <td className="p-3 font-mono font-bold text-signal">{r.device_id || "—"}</td>
                  <td className="p-3 font-mono font-semibold">{r.ticket_id || "—"}</td>
                  <td className="p-3">{r.company_name || "—"}</td>
                  <td className="p-3">{r.engineer_name || <span className="text-slate-400">Unassigned</span>}</td>
                  <td className="p-3"><StatusBadge status={r.status} /></td>
                  <td className="p-3 text-xs text-slate-600 whitespace-nowrap">{r.created_date || "—"}</td>
                  <td className="p-3 text-xs text-slate-600 whitespace-nowrap">{r.closed_date || "—"}</td>
                  <td className="p-3 font-mono text-xs">{r.product_reference_number || "—"}</td>
                  <td className="p-3 font-mono text-xs">{r.oem_reference_number || "—"}</td>
                  <td className="p-3 text-right">
                    <div className="flex gap-1.5 justify-end">
                      {showDeleted && r._deleted ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => restore(r)}
                          data-testid={`device-history-restore-btn-${r.id}`}
                        >
                          <ArchiveRestore className="w-3.5 h-3.5" /> Restore
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => setConfirmRow(r)}
                          data-testid={`device-history-delete-btn-${r.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && pageRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-slate-500" data-testid="device-history-empty">
                    No records found for the selected filters.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-slate-500">Loading…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <div className="text-xs text-slate-500">
              Page <b>{page}</b> of <b>{totalPages}</b>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 px-2 gap-1"
                data-testid="device-history-prev-page"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 px-2 gap-1"
                data-testid="device-history-next-page"
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!confirmRow}
        onOpenChange={(v) => !v && setConfirmRow(null)}
      >
        <AlertDialogContent data-testid="device-history-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete device history record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will soft-delete ticket{" "}
              <span className="font-mono font-bold">{confirmRow?.ticket_id}</span>{" "}
              from device history. The record will be hidden from listings and
              exports but can be restored later. Active tickets cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="device-history-confirm-cancel">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={performDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="device-history-confirm-delete"
            >
              Yes, delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
