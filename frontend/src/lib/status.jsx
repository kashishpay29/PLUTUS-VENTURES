// Helpers for status display
export const STATUSES = [
  "open", "assigned", "accepted", "travelling",
  "reached_site", "in_progress", "resolved",
  "completed_with_signature", "report_generated", "closed",
];

export const STATUS_LABEL = {
  open: "Open",
  assigned: "Assigned",
  accepted: "Accepted",
  travelling: "Travelling",
  reached_site: "Reached Site",
  in_progress: "In Progress",
  resolved: "Resolved",
  completed_with_signature: "Signed",
  report_generated: "Report Ready",
  closed: "Closed",
  completed: "Completed",  // legacy
  rejected: "Rejected",
};

export const STATUS_COLOR = {
  open: "#3B82F6",
  assigned: "#8B5CF6",
  accepted: "#F59E0B",
  travelling: "#06B6D4",
  reached_site: "#10B981",
  in_progress: "#F97316",
  resolved: "#14B8A6",
  completed_with_signature: "#7C3AED",
  report_generated: "#0891B2",
  closed: "#16A34A",
  completed: "#16A34A",  // legacy
  rejected: "#EF4444",
};

export function StatusBadge({ status, className = "" }) {
  const color = STATUS_COLOR[status] || "#64748B";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${className}`}
      style={{ background: color + "1a", color }}
      data-testid={`status-badge-${status}`}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch { return iso; }
}

export function formatDateShort(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch { return iso; }
}
