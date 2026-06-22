"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CalendarDays, X } from "lucide-react";

import type { AuditLogEntry } from "@/app/inventory/_lib/audit-log";

type AuditLogProps = {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  dateFrom?: string;
  dateTo?: string;
};

// ─── Action metadata ────────────────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; badgeColor: string; rowAccent: string }> = {
  // Slab
  "slab.created":             { label: "Slab Added",           badgeColor: "bg-green-100 text-green-700",   rowAccent: "border-green-400" },
  "slab.edited":              { label: "Slab Edited",          badgeColor: "bg-blue-100 text-blue-700",     rowAccent: "border-blue-400" },
  "slab.status_changed":      { label: "Status Changed",       badgeColor: "bg-purple-100 text-purple-700", rowAccent: "border-purple-400" },
  "slab.deleted":             { label: "Slab Deleted",         badgeColor: "bg-red-100 text-red-700",       rowAccent: "border-red-400" },
  "slab.archived":            { label: "Slab Archived",        badgeColor: "bg-orange-100 text-orange-700", rowAccent: "border-orange-400" },
  "slab.restored":            { label: "Slab Restored",        badgeColor: "bg-green-100 text-green-700",   rowAccent: "border-green-400" },
  "slab.permanently_deleted": { label: "Permanently Deleted",  badgeColor: "bg-red-600 text-white",         rowAccent: "border-red-600" },
  "slab.image_uploaded":      { label: "Photo Added",          badgeColor: "bg-sky-100 text-sky-700",       rowAccent: "border-sky-400" },
  "slab.image_deleted":       { label: "Photo Deleted",        badgeColor: "bg-red-100 text-red-700",       rowAccent: "border-red-400" },
  // Lot
  "lot.created":              { label: "Lot Created",          badgeColor: "bg-green-100 text-green-700",   rowAccent: "border-green-400" },
  "lot.edited":               { label: "Lot Edited",           badgeColor: "bg-blue-100 text-blue-700",     rowAccent: "border-blue-400" },
  "lot.deleted":              { label: "Lot Deleted",          badgeColor: "bg-red-100 text-red-700",       rowAccent: "border-red-400" },
  "lot.archived":             { label: "Lot Archived",         badgeColor: "bg-orange-100 text-orange-700", rowAccent: "border-orange-400" },
  "lot.restored":             { label: "Lot Restored",         badgeColor: "bg-green-100 text-green-700",   rowAccent: "border-green-400" },
  "lot.permanently_deleted":  { label: "Permanently Deleted",  badgeColor: "bg-red-600 text-white",         rowAccent: "border-red-600" },
  "lot.bulk_status_changed":  { label: "Bulk Status Change",   badgeColor: "bg-purple-100 text-purple-700", rowAccent: "border-purple-400" },
  // Movement / Transfer
  "movement.recorded":       { label: "Moved",                 badgeColor: "bg-amber-100 text-amber-700",   rowAccent: "border-amber-400" },
  "movement.batch_recorded": { label: "Batch Move",            badgeColor: "bg-amber-100 text-amber-700",   rowAccent: "border-amber-400" },
  "transfer.created":        { label: "Transfer Sent",         badgeColor: "bg-indigo-100 text-indigo-700", rowAccent: "border-indigo-400" },
  "transfer.received":       { label: "Transfer Received",     badgeColor: "bg-teal-100 text-teal-700",     rowAccent: "border-teal-400" },
  "transfer.cancelled":      { label: "Transfer Cancelled",    badgeColor: "bg-red-100 text-red-700",       rowAccent: "border-red-400" },
  // Quotation
  "quotation.pdf_downloaded":  { label: "PDF Downloaded",       badgeColor: "bg-violet-100 text-violet-700", rowAccent: "border-violet-400" },
  "quotation.whatsapp_shared": { label: "WhatsApp Shared",      badgeColor: "bg-green-100 text-green-700",   rowAccent: "border-green-400" },
  // User
  "user.invited":            { label: "User Invited",          badgeColor: "bg-green-100 text-green-700",   rowAccent: "border-green-400" },
  "user.role_changed":       { label: "Role Changed",          badgeColor: "bg-orange-100 text-orange-700", rowAccent: "border-orange-400" },
  "user.permission_changed": { label: "Permission Changed",    badgeColor: "bg-orange-100 text-orange-700", rowAccent: "border-orange-400" },
  "user.removed":            { label: "User Removed",          badgeColor: "bg-red-100 text-red-700",       rowAccent: "border-red-400" },
};

const TARGET_TYPE_META: Record<string, { label: string; color: string }> = {
  slab:     { label: "Slab",     color: "bg-gray-100 text-gray-600" },
  lot:      { label: "Lot",      color: "bg-indigo-50 text-indigo-600" },
  user:     { label: "User",     color: "bg-teal-50 text-teal-600" },
  transfer:  { label: "Transfer",  color: "bg-amber-50 text-amber-600" },
  quotation: { label: "Quotation", color: "bg-violet-50 text-violet-600" },
};

const PAGE_SIZE = 50;

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDateTime(value: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function str(v: unknown): string {
  return v != null ? String(v) : "—";
}

function getSummary(entry: AuditLogEntry): string | null {
  const d = entry.diff ?? {};

  switch (entry.action) {
    case "slab.created":
      return [d.marbleName, d.sqft ? `${d.sqft} sqft` : null, d.rackNumber ? `Rack ${d.rackNumber}` : null]
        .filter(Boolean)
        .join(" · ");

    case "slab.image_uploaded":
      return d.imageCount != null
        ? `${d.imageCount} photo${Number(d.imageCount) === 1 ? "" : "s"} added`
        : null;

    case "slab.image_deleted":
      return "Photo removed";

    case "slab.status_changed":
      return `${str(d.before)} → ${str(d.after)}`;

    case "slab.edited": {
      const b = d.before as Record<string, unknown> | undefined;
      const a = d.after as Record<string, unknown> | undefined;
      if (!b || !a) return null;
      const parts: string[] = [];
      if (b.slabCode !== a.slabCode)
        parts.push(`Code: ${str(b.slabCode)} → ${str(a.slabCode)}`);
      if (String(b.length) !== String(a.length) || String(b.width) !== String(a.width))
        parts.push(`Size: ${str(b.length)}×${str(b.width)} → ${str(a.length)}×${str(a.width)}`);
      if (b.rackNumber !== a.rackNumber)
        parts.push(`Rack: ${str(b.rackNumber)} → ${str(a.rackNumber)}`);
      if (b.notes !== a.notes)
        parts.push("Notes updated");
      return parts.length > 0 ? parts.join(" · ") : "No field changes";
    }

    case "slab.deleted":
    case "slab.archived":
      return [d.marbleName, d.sqft ? `${d.sqft} sqft` : null, d.warehouse]
        .filter(Boolean)
        .join(" · ");

    case "slab.permanently_deleted":
      return "Removed from database permanently";

    case "slab.restored":
      return "Restored from archive";

    case "lot.created":
      return [
        d.marbleName,
        d.slabCount != null ? `${d.slabCount} slab${Number(d.slabCount) === 1 ? "" : "s"}` : null,
        d.supplierName,
      ]
        .filter(Boolean)
        .join(" · ");

    case "lot.edited": {
      const b = d.before as Record<string, unknown> | undefined;
      const a = d.after as Record<string, unknown> | undefined;
      if (!b || !a) return null;
      const parts: string[] = [];
      if (b.marbleName !== a.marbleName)
        parts.push(`Name: ${str(b.marbleName)} → ${str(a.marbleName)}`);
      if (b.lotNumber !== a.lotNumber)
        parts.push(`Lot#: ${str(b.lotNumber)} → ${str(a.lotNumber)}`);
      if (b.sellingPrice !== a.sellingPrice)
        parts.push(`Sell: ₹${str(b.sellingPrice)} → ₹${str(a.sellingPrice)}`);
      if (b.supplierName !== a.supplierName)
        parts.push(`Supplier: ${str(b.supplierName)} → ${str(a.supplierName)}`);
      return parts.length > 0 ? parts.join(" · ") : "No field changes";
    }

    case "lot.deleted":
    case "lot.archived":
      return [
        d.marbleName,
        d.slabCount != null
          ? `${d.slabCount} slab${Number(d.slabCount) === 1 ? "" : "s"} archived`
          : null,
      ]
        .filter(Boolean)
        .join(" · ");

    case "lot.permanently_deleted":
      return [
        d.marbleName,
        d.slabCount != null
          ? `${d.slabCount} slab${Number(d.slabCount) === 1 ? "" : "s"} erased`
          : null,
      ]
        .filter(Boolean)
        .join(" · ");

    case "lot.restored":
      return "Restored from archive";

    case "lot.bulk_status_changed": {
      const actionLabel: Record<string, string> = {
        Reserved: "Reserved all",
        Sold: "Marked all Sold",
        UnreserveLot: "Unreserved all",
        UnsellLot: "Marked all Available",
      };
      const parts: string[] = [];
      if (d.action) parts.push(actionLabel[String(d.action)] ?? String(d.action));
      if (d.slabCount != null) parts.push(`${d.slabCount} slab${Number(d.slabCount) === 1 ? "" : "s"}`);
      if (d.reservedFor) parts.push(`for ${str(d.reservedFor)}`);
      return parts.join(" · ") || null;
    }

    case "user.invited":
      return d.role ? `Role: ${str(d.role)}` : null;

    case "user.role_changed":
      return d.role ? `New role: ${str(d.role)}` : null;

    case "user.permission_changed":
      return d.permission != null
        ? `${str(d.permission)}: ${d.enabled ? "granted" : "revoked"}`
        : null;

    case "user.removed":
      return "Account permanently deleted";

    case "quotation.pdf_downloaded":
    case "quotation.whatsapp_shared": {
      const parts: string[] = [];
      if (d.customerName) parts.push(String(d.customerName));
      if (d.slabCount != null) parts.push(`${d.slabCount} slab${Number(d.slabCount) === 1 ? "" : "s"}`);
      if (d.grandTotal != null) parts.push(`₹${Number(d.grandTotal).toLocaleString("en-IN")}`);
      return parts.length > 0 ? parts.join(" · ") : null;
    }

    case "movement.recorded":
      return d.from && d.to ? `${str(d.from)} → ${str(d.to)}` : null;

    case "movement.batch_recorded":
      return [
        d.slabCount != null ? `${d.slabCount} slab${Number(d.slabCount) === 1 ? "" : "s"}` : null,
        d.from && d.to ? `${str(d.from)} → ${str(d.to)}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

    case "transfer.created":
      return [
        d.slabCount != null ? `${d.slabCount} slab${Number(d.slabCount) === 1 ? "" : "s"}` : null,
        d.from && d.to ? `${str(d.from)} → ${str(d.to)}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

    case "transfer.received":
    case "transfer.cancelled":
      return [
        d.slabCount != null ? `${d.slabCount} slab${Number(d.slabCount) === 1 ? "" : "s"}` : null,
        d.from && d.to ? `${str(d.from)} → ${str(d.to)}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

    default:
      return null;
  }
}

function getLotId(entry: AuditLogEntry): string | null {
  if (entry.targetType !== "slab") return null;
  const d = entry.diff ?? {};
  return d.lotId ? String(d.lotId) : null;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function TargetCell({ entry }: { entry: AuditLogEntry }) {
  const lotId = getLotId(entry);

  const label = entry.targetLabel ? (
    entry.targetType === "slab" && entry.targetId && entry.action !== "slab.deleted" && entry.action !== "slab.archived" && entry.action !== "slab.permanently_deleted" ? (
      <Link
        href={`/inventory/slab/${entry.targetId}`}
        className="font-mono text-xs font-semibold text-blue-600 hover:underline"
      >
        {entry.targetLabel}
      </Link>
    ) : entry.targetType === "lot" && entry.targetId && entry.action !== "lot.deleted" && entry.action !== "lot.archived" && entry.action !== "lot.permanently_deleted" ? (
      <Link
        href={`/inventory/lot/${entry.targetId}`}
        className="font-mono text-xs font-semibold text-blue-600 hover:underline"
      >
        {entry.targetLabel}
      </Link>
    ) : (
      <span className="font-mono text-xs font-semibold text-gray-700">
        {entry.targetLabel}
      </span>
    )
  ) : (
    <span className="text-gray-400">—</span>
  );

  return (
    <div className="space-y-1">
      {label}
      {lotId && (
        <div>
          <Link
            href={`/inventory/lot/${lotId}`}
            className="text-[10px] text-gray-400 hover:text-blue-500 hover:underline transition-colors"
          >
            ↳ View Lot
          </Link>
        </div>
      )}
    </div>
  );
}

function DiffCell({ diff }: { diff: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const hasBefore = "before" in diff && "after" in diff;

  const displayDiff = { ...diff };
  delete displayDiff.lotId;

  if (Object.keys(displayDiff).length === 0) return <span className="text-xs text-gray-300">—</span>;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[10px] font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {open ? "Hide" : "Raw diff"}
      </button>

      {open && (
        <div className="mt-2">
          {hasBefore ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-gray-400">Before</p>
                <pre className="overflow-auto rounded-lg bg-red-50 p-2 text-[10px] leading-relaxed text-red-800 max-h-28">
                  {JSON.stringify(displayDiff.before, null, 2)}
                </pre>
              </div>
              <div>
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-gray-400">After</p>
                <pre className="overflow-auto rounded-lg bg-green-50 p-2 text-[10px] leading-relaxed text-green-800 max-h-28">
                  {JSON.stringify(displayDiff.after, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <pre className="overflow-auto rounded-lg bg-gray-50 p-2 text-[10px] leading-relaxed text-gray-700 max-h-28">
              {JSON.stringify(displayDiff, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function AuditLog({ entries, total, page, dateFrom, dateTo }: AuditLogProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [fromVal, setFromVal] = useState(dateFrom ?? "");
  const [toVal, setToVal] = useState(dateTo ?? "");

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`?${params.toString()}`);
  }

  function applyDateFilter() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (fromVal) params.set("from", fromVal); else params.delete("from");
    if (toVal) params.set("to", toVal); else params.delete("to");
    router.push(`?${params.toString()}`);
  }

  function clearDateFilter() {
    setFromVal("");
    setToVal("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("from");
    params.delete("to");
    params.delete("page");
    router.push(`?${params.toString()}`);
  }

  const hasActiveFilter = !!(dateFrom || dateTo);

  return (
    <div className="space-y-4">
      {/* Date range filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <CalendarDays className="h-4 w-4 shrink-0 text-gray-400 self-center" />
        <div className="flex flex-wrap items-end gap-2 flex-1">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">From</label>
            <input
              type="date"
              value={fromVal}
              max={toVal || undefined}
              onChange={(e) => setFromVal(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 focus:border-gray-400 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">To</label>
            <input
              type="date"
              value={toVal}
              min={fromVal || undefined}
              onChange={(e) => setToVal(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 focus:border-gray-400 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={applyDateFilter}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-700"
          >
            Apply
          </button>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={clearDateFilter}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>
        {hasActiveFilter && (
          <p className="text-xs text-gray-400 self-center">
            Filtered
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {total === 0
            ? "No activity recorded yet."
            : `${total.toLocaleString()} event${total === 1 ? "" : "s"} total`}
        </p>
        {totalPages > 1 && (
          <p className="text-xs text-gray-400">Page {page + 1} of {totalPages}</p>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center">
          <p className="text-sm text-gray-400">No events to display.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-200 border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50">
                  {/* accent spacer */}
                  <th className="w-1 border-r-2 border-gray-200 p-0" />
                  <th className="border-r-2 border-gray-200 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Date &amp; Time
                  </th>
                  <th className="border-r-2 border-gray-200 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    User
                  </th>
                  <th className="border-r-2 border-gray-200 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Type
                  </th>
                  <th className="border-r-2 border-gray-200 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Action
                  </th>
                  <th className="border-r-2 border-gray-200 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Target
                  </th>
                  <th className="border-r-2 border-gray-200 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Summary
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Raw Diff
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {entries.map((entry) => {
                  const meta = ACTION_META[entry.action] ?? {
                    label: entry.action,
                    badgeColor: "bg-gray-100 text-gray-600",
                    rowAccent: "border-gray-300",
                  };
                  const typeMeta = entry.targetType
                    ? (TARGET_TYPE_META[entry.targetType] ?? { label: entry.targetType, color: "bg-gray-100 text-gray-500" })
                    : null;
                  const summary = getSummary(entry);
                  const hasDiff = entry.diff && Object.keys(entry.diff).length > 0;

                  return (
                    <tr key={entry.id} className="align-top transition-colors hover:bg-gray-50/60">
                      {/* Colored left-border accent */}
                      <td className={`w-1 border-r-2 border-gray-200 border-l-4 p-0 ${meta.rowAccent}`} />

                      {/* Date & Time */}
                      <td className="whitespace-nowrap border-r-2 border-gray-200 px-4 py-3.5 text-xs text-gray-500">
                        {fmtDateTime(entry.createdAt)}
                      </td>

                      {/* User */}
                      <td className="max-w-45 border-r-2 border-gray-200 px-4 py-3.5">
                        <span
                          className="block truncate text-xs text-gray-700"
                          title={entry.userEmail ?? undefined}
                        >
                          {entry.userEmail ?? <span className="text-gray-300">Unknown</span>}
                        </span>
                      </td>

                      {/* Type badge */}
                      <td className="whitespace-nowrap border-r-2 border-gray-200 px-4 py-3.5">
                        {typeMeta ? (
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${typeMeta.color}`}>
                            {typeMeta.label}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Action badge */}
                      <td className="whitespace-nowrap border-r-2 border-gray-200 px-4 py-3.5">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${meta.badgeColor}`}>
                          {meta.label}
                        </span>
                      </td>

                      {/* Target + lot link */}
                      <td className="border-r-2 border-gray-200 px-4 py-3.5">
                        <TargetCell entry={entry} />
                      </td>

                      {/* Summary */}
                      <td className="border-r-2 border-gray-200 px-4 py-3.5 text-xs text-gray-600">
                        {summary ?? <span className="text-gray-300">—</span>}
                      </td>

                      {/* Raw diff */}
                      <td className="px-4 py-3.5">
                        {hasDiff ? (
                          <DiffCell diff={entry.diff!} />
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={page === 0}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-gray-600">{page + 1} / {totalPages}</span>
          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages - 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
