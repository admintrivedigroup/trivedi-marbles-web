"use client";

import { useState, useTransition, useMemo } from "react";
import {
  ChevronDown,
  ChevronUp,
  Edit2,
  Loader2,
  Phone,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import {
  createArchitectLead,
  updateArchitectLead,
  deleteArchitectLead,
  bulkDeleteArchitectLeads,
  type ArchitectLeadFormData,
} from "@/app/inventory/_actions/architect-leads";
import type { ArchitectLead } from "@/app/inventory/_lib/architect-leads";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = keyof ArchitectLead;
type SortDir = "asc" | "desc";

const EMPTY_FORM: ArchitectLeadFormData = {
  architect_name: "",
  architect_number: "",
  contractor_name: "",
  contractor_number: "",
  project_type: "",
  facade: "",
  bedroom: "",
  interior_wall_cladding: "",
  main_flooring: "",
  kitchen_flooring: "",
  kitchen_platform: "",
  store_room: "",
  table_tops: "",
  staircase: "",
  pillars: "",
  bathroom: "",
  car_parking_outside: "",
  window_sill: "",
  home_temple: "",
  preference: "",
  source_of_lead: "",
  payment: "",
  notes: "",
  quarry_mark: "",
};

// ─── Field definitions ────────────────────────────────────────────────────────

const ROOM_FIELDS: { key: keyof ArchitectLeadFormData; label: string }[] = [
  { key: "facade", label: "Façade" },
  { key: "bedroom", label: "Bedroom" },
  { key: "interior_wall_cladding", label: "Interior Wall Cladding" },
  { key: "main_flooring", label: "Main Flooring" },
  { key: "kitchen_flooring", label: "Kitchen Flooring" },
  { key: "kitchen_platform", label: "Kitchen Platform" },
  { key: "store_room", label: "Store Room" },
  { key: "table_tops", label: "Table Tops" },
  { key: "staircase", label: "Staircase" },
  { key: "pillars", label: "Pillars" },
  { key: "bathroom", label: "Bathroom" },
  { key: "car_parking_outside", label: "Car Parking & Outside Area" },
  { key: "window_sill", label: "Window Sill" },
  { key: "home_temple", label: "Home Temple" },
];

// Columns shown in the table (abbreviated labels for narrow columns)
const TABLE_COLS: { key: keyof ArchitectLead; label: string; minWidth?: string }[] = [
  { key: "architect_name", label: "Architect Name", minWidth: "160px" },
  { key: "architect_number", label: "Architect No." },
  { key: "contractor_name", label: "Contractor" },
  { key: "contractor_number", label: "Contractor No." },
  { key: "project_type", label: "Project Type" },
  { key: "facade", label: "Façade" },
  { key: "bedroom", label: "Bedroom" },
  { key: "main_flooring", label: "Main Floor" },
  { key: "kitchen_flooring", label: "Kitchen Floor" },
  { key: "bathroom", label: "Bathroom" },
  { key: "source_of_lead", label: "Source" },
  { key: "payment", label: "Payment" },
  { key: "quarry_mark", label: "Quarry Mark" },
  { key: "preference", label: "Preference" },
  { key: "notes", label: "Notes", minWidth: "200px" },
];

// ─── Props ────────────────────────────────────────────────────────────────────

type ArchitectLeadsProps = {
  initialLeads: ArchitectLead[];
};

// ─── Delete confirm dialog ────────────────────────────────────────────────────

function DeleteConfirm({
  name,
  onConfirm,
  onCancel,
  loading,
}: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">Delete lead?</h3>
        <p className="mt-2 text-sm text-gray-500">
          <span className="font-medium text-gray-700">{name}</span> will be permanently removed.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk delete confirm dialog ───────────────────────────────────────────────

function BulkDeleteConfirm({
  count,
  onConfirm,
  onCancel,
  loading,
}: {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">
          Delete {count} lead{count !== 1 ? "s" : ""}?
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          Selected leads will be permanently removed.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Lead Form Drawer ─────────────────────────────────────────────────────────

function LeadFormDrawer({
  lead,
  onClose,
}: {
  lead: ArchitectLead | null; // null = new lead
  onClose: () => void;
}) {
  const isEdit = lead !== null;
  const [form, setForm] = useState<ArchitectLeadFormData>(
    lead
      ? {
          architect_name: lead.architect_name,
          architect_number: lead.architect_number ?? "",
          contractor_name: lead.contractor_name ?? "",
          contractor_number: lead.contractor_number ?? "",
          project_type: lead.project_type ?? "",
          facade: lead.facade ?? "",
          bedroom: lead.bedroom ?? "",
          interior_wall_cladding: lead.interior_wall_cladding ?? "",
          main_flooring: lead.main_flooring ?? "",
          kitchen_flooring: lead.kitchen_flooring ?? "",
          kitchen_platform: lead.kitchen_platform ?? "",
          store_room: lead.store_room ?? "",
          table_tops: lead.table_tops ?? "",
          staircase: lead.staircase ?? "",
          pillars: lead.pillars ?? "",
          bathroom: lead.bathroom ?? "",
          car_parking_outside: lead.car_parking_outside ?? "",
          window_sill: lead.window_sill ?? "",
          home_temple: lead.home_temple ?? "",
          preference: lead.preference ?? "",
          source_of_lead: lead.source_of_lead ?? "",
          payment: lead.payment ?? "",
          notes: lead.notes ?? "",
          quarry_mark: lead.quarry_mark ?? "",
        }
      : { ...EMPTY_FORM },
  );

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof ArchitectLeadFormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.architect_name.trim()) {
      setError("Architect name is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updateArchitectLead(lead.id, form)
        : await createArchitectLead(form);
      if (result.success) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close form"
        className="absolute inset-0"
        onClick={onClose}
      />
      {/* Drawer panel */}
      <div className="relative z-10 flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? "Edit Lead" : "Add New Lead"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Architect & Contractor */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Architect & Contractor
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Architect Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.architect_name}
                  onChange={(e) => set("architect_name", e.target.value)}
                  placeholder="Ar. Monil Gujar"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Architect Number</label>
                <input
                  type="tel"
                  value={form.architect_number ?? ""}
                  onChange={(e) => set("architect_number", e.target.value)}
                  placeholder="9825000000"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contractor / Mistry Name</label>
                <input
                  type="text"
                  value={form.contractor_name ?? ""}
                  onChange={(e) => set("contractor_name", e.target.value)}
                  placeholder="Contractor name"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contractor / Mistry Number</label>
                <input
                  type="tel"
                  value={form.contractor_number ?? ""}
                  onChange={(e) => set("contractor_number", e.target.value)}
                  placeholder="9825000000"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Type</label>
                <input
                  type="text"
                  value={form.project_type ?? ""}
                  onChange={(e) => set("project_type", e.target.value)}
                  placeholder="e.g. Residential, Commercial"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
                />
              </div>
            </div>
          </section>

          {/* Room / Area Requirements */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Room / Area Requirements
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {ROOM_FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type="text"
                    value={(form[key] as string) ?? ""}
                    onChange={(e) => set(key, e.target.value)}
                    placeholder="Material / details"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Other */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Other Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preference</label>
                <input
                  type="text"
                  value={form.preference ?? ""}
                  onChange={(e) => set("preference", e.target.value)}
                  placeholder="e.g. 400–500 Rs"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source of Lead</label>
                <input
                  type="text"
                  value={form.source_of_lead ?? ""}
                  onChange={(e) => set("source_of_lead", e.target.value)}
                  placeholder="e.g. Referral, Site Visit"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment</label>
                <input
                  type="text"
                  value={form.payment ?? ""}
                  onChange={(e) => set("payment", e.target.value)}
                  placeholder="e.g. Cash, Bank"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quarry Mark</label>
                <input
                  type="text"
                  value={form.quarry_mark ?? ""}
                  onChange={(e) => set("quarry_mark", e.target.value)}
                  placeholder="e.g. Block / lot mark"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={form.notes ?? ""}
                  onChange={(e) => set("notes", e.target.value)}
                  rows={3}
                  placeholder="Any additional notes…"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100 resize-none"
                />
              </div>
            </div>
          </section>

          {error ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
          ) : null}
        </form>

        {/* Footer */}
        <div className="flex gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form=""
            onClick={(e) => {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent);
            }}
            disabled={isPending}
            className="flex-1 rounded-xl bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isEdit ? "Save Changes" : "Add Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Cell value renderer ──────────────────────────────────────────────────────

function CellValue({ col, lead }: { col: keyof ArchitectLead; lead: ArchitectLead }) {
  if ((col === "architect_number" || col === "contractor_number") && lead[col]) {
    return (
      <a
        href={`tel:${lead[col]}`}
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline whitespace-nowrap"
        onClick={(e) => e.stopPropagation()}
      >
        <Phone className="h-3 w-3" />
        {lead[col]}
      </a>
    );
  }

  if (col === "notes") {
    const val = lead.notes;
    if (!val) return <span className="text-gray-300">—</span>;
    return (
      <span className="block max-w-[200px] truncate text-sm text-gray-600" title={val}>
        {val}
      </span>
    );
  }

  const val = lead[col];
  if (val === null || val === undefined || val === "") {
    return <span className="text-gray-300">—</span>;
  }
  return <span className="whitespace-nowrap text-sm text-gray-700">{String(val)}</span>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ArchitectLeads({ initialLeads }: ArchitectLeadsProps) {
  const [leads, setLeads] = useState<ArchitectLead[]>(initialLeads);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [drawerLead, setDrawerLead] = useState<ArchitectLead | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ArchitectLead | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [filterProjectType, setFilterProjectType] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, startBulkDelete] = useTransition();

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const projectTypes = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.project_type && l.project_type.trim()) set.add(l.project_type.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const filtered = useMemo(() => {
    let list = leads;

    if (filterProjectType !== "all") {
      list = list.filter((l) => l.project_type === filterProjectType);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) =>
        [
          l.architect_name,
          l.architect_number,
          l.contractor_name,
          l.contractor_number,
          l.project_type,
          l.source_of_lead,
          l.quarry_mark,
          l.notes,
        ]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q)),
      );
    }

    // Sort
    list = [...list].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [leads, search, filterProjectType, sortKey, sortDir]);

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    startDelete(async () => {
      const result = await deleteArchitectLead(targetId);
      if (result.success) {
        setLeads((prev) => prev.filter((l) => l.id !== targetId));
      }
      setDeleteTarget(null);
    });
  }

  function handleDrawerClose() {
    setDrawerLead(null);
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((l) => selectedIds.has(l.id));
  const someFilteredSelected = filtered.some((l) => selectedIds.has(l.id));

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filtered.forEach((l) => next.delete(l.id));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach((l) => next.add(l.id));
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function handleBulkDeleteConfirm() {
    const ids = Array.from(selectedIds);
    startBulkDelete(async () => {
      const result = await bulkDeleteArchitectLeads(ids);
      if (result.success) {
        setLeads((prev) => prev.filter((l) => !selectedIds.has(l.id)));
        clearSelection();
      }
      setBulkDeleteConfirm(false);
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Architect Leads</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {leads.length} lead{leads.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDrawerLead("new")}
          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Lead
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads…"
            className="w-64 rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
          />
        </div>
        <select
          value={filterProjectType}
          onChange={(e) => setFilterProjectType(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
        >
          <option value="all">All Project Types</option>
          {projectTypes.map((pt) => (
            <option key={pt} value={pt}>
              {pt}
            </option>
          ))}
        </select>
        {filtered.length !== leads.length ? (
          <span className="text-sm text-gray-500">{filtered.length} shown</span>
        ) : null}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5">
          <span className="text-sm font-medium text-gray-700">
            {selectedIds.size} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setBulkDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Selected
            </button>
          </div>
          <button
            type="button"
            onClick={clearSelection}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
          >
            <X className="h-3.5 w-3.5" />
            Clear selection
          </button>
        </div>
      ) : null}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-lg font-medium text-gray-400">No leads found</p>
            <p className="mt-1 text-sm text-gray-400">
              {leads.length === 0
                ? "Add your first lead to get started."
                : "Try adjusting your search or filters."}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all leads"
                    checked={allFilteredSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allFilteredSelected && someFilteredSelected;
                    }}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
                  />
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  S. No
                </th>
                {TABLE_COLS.map((col) => (
                  <th
                    key={col.key}
                    className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:text-gray-700"
                    style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key ? (
                        sortDir === "asc" ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )
                      ) : null}
                    </span>
                  </th>
                ))}
                {/* Actions col */}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead, idx) => (
                <tr
                  key={lead.id}
                  className={cn(
                    "border-b border-gray-100 last:border-0 transition-colors",
                    selectedIds.has(lead.id)
                      ? "bg-blue-100"
                      : idx % 2 === 0
                        ? "bg-white hover:bg-gray-50"
                        : "bg-gray-50/40 hover:bg-gray-50",
                  )}
                >
                  <td className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${lead.architect_name}`}
                      checked={selectedIds.has(lead.id)}
                      onChange={() => toggleSelectOne(lead.id)}
                      className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {idx + 1}
                  </td>
                  {TABLE_COLS.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <CellValue col={col.key} lead={lead} />
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Edit"
                        onClick={() => setDrawerLead(lead)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => setDeleteTarget(lead)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit drawer */}
      {drawerLead !== null ? (
        <LeadFormDrawer
          lead={drawerLead === "new" ? null : drawerLead}
          onClose={handleDrawerClose}
        />
      ) : null}

      {/* Bulk delete confirm */}
      {bulkDeleteConfirm ? (
        <BulkDeleteConfirm
          count={selectedIds.size}
          onConfirm={handleBulkDeleteConfirm}
          onCancel={() => setBulkDeleteConfirm(false)}
          loading={isBulkDeleting}
        />
      ) : null}

      {/* Delete confirm */}
      {deleteTarget !== null ? (
        <DeleteConfirm
          name={deleteTarget.architect_name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          loading={isDeleting}
        />
      ) : null}
    </div>
  );
}
