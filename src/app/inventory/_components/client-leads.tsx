"use client";

import { useState, useTransition, useMemo } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit2,
  Loader2,
  Phone,
  Plus,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

import {
  createClientLead,
  updateClientLead,
  deleteClientLead,
  toggleLeadConverted,
  type ClientLeadFormData,
} from "@/app/inventory/_actions/client-leads";
import type { ClientLead } from "@/app/inventory/_lib/client-leads";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = keyof ClientLead;
type SortDir = "asc" | "desc";

const EMPTY_FORM: ClientLeadFormData = {
  client_name: "",
  contact_no: "",
  requirement_sqft: "",
  material_category: "",
  converted: false,
  first_visit_date: "",
  architect_name: "",
  architect_contact: "",
  contractor_name: "",
  contractor_contact: "",
  project_type: "",
  facade: "",
  bedroom: "",
  interior_wall_cladding: "",
  main_flooring: "",
  kitchen_flooring: "",
  store_room: "",
  bathroom: "",
  car_parking_outside: "",
  window_sill: "",
  home_temple: "",
  preference: "",
  paid_from: "",
  source_of_lead: "",
  notes: "",
};

// ─── Field definitions ────────────────────────────────────────────────────────

const ROOM_FIELDS: { key: keyof ClientLeadFormData; label: string }[] = [
  { key: "facade", label: "Façade" },
  { key: "bedroom", label: "Bedroom" },
  { key: "interior_wall_cladding", label: "Interior Wall Cladding" },
  { key: "main_flooring", label: "Main Flooring" },
  { key: "kitchen_flooring", label: "Kitchen Flooring" },
  { key: "store_room", label: "Store Room" },
  { key: "bathroom", label: "Bathroom" },
  { key: "car_parking_outside", label: "Car Parking & Outside" },
  { key: "window_sill", label: "Window Sill" },
  { key: "home_temple", label: "Home Temple" },
];

// Columns shown in the table (abbreviated labels for narrow columns)
const TABLE_COLS: { key: keyof ClientLead; label: string; minWidth?: string }[] = [
  { key: "client_name", label: "Client Name", minWidth: "160px" },
  { key: "contact_no", label: "Contact" },
  { key: "requirement_sqft", label: "Req. (sqft)" },
  { key: "material_category", label: "Category" },
  { key: "converted", label: "Converted" },
  { key: "first_visit_date", label: "First Visit" },
  { key: "architect_name", label: "Architect" },
  { key: "contractor_name", label: "Contractor" },
  { key: "project_type", label: "Project Type" },
  { key: "facade", label: "Façade" },
  { key: "bedroom", label: "Bedroom" },
  { key: "main_flooring", label: "Main Floor" },
  { key: "kitchen_flooring", label: "Kitchen Floor" },
  { key: "bathroom", label: "Bathroom" },
  { key: "source_of_lead", label: "Source" },
  { key: "preference", label: "Preference" },
  { key: "notes", label: "Notes", minWidth: "200px" },
];

// ─── Props ────────────────────────────────────────────────────────────────────

type ClientLeadsProps = {
  initialLeads: ClientLead[];
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

// ─── Lead Form Drawer ─────────────────────────────────────────────────────────

function LeadFormDrawer({
  lead,
  onClose,
}: {
  lead: ClientLead | null; // null = new lead
  onClose: () => void;
}) {
  const isEdit = lead !== null;
  const [form, setForm] = useState<ClientLeadFormData>(
    lead
      ? {
          client_name: lead.client_name,
          contact_no: lead.contact_no ?? "",
          requirement_sqft: lead.requirement_sqft ?? "",
          material_category: lead.material_category ?? "",
          converted: lead.converted,
          first_visit_date: lead.first_visit_date ?? "",
          architect_name: lead.architect_name ?? "",
          architect_contact: lead.architect_contact ?? "",
          contractor_name: lead.contractor_name ?? "",
          contractor_contact: lead.contractor_contact ?? "",
          project_type: lead.project_type ?? "",
          facade: lead.facade ?? "",
          bedroom: lead.bedroom ?? "",
          interior_wall_cladding: lead.interior_wall_cladding ?? "",
          main_flooring: lead.main_flooring ?? "",
          kitchen_flooring: lead.kitchen_flooring ?? "",
          store_room: lead.store_room ?? "",
          bathroom: lead.bathroom ?? "",
          car_parking_outside: lead.car_parking_outside ?? "",
          window_sill: lead.window_sill ?? "",
          home_temple: lead.home_temple ?? "",
          preference: lead.preference ?? "",
          paid_from: lead.paid_from ?? "",
          source_of_lead: lead.source_of_lead ?? "",
          notes: lead.notes ?? "",
        }
      : { ...EMPTY_FORM },
  );

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof ClientLeadFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.client_name.trim()) {
      setError("Client name is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updateClientLead(lead.id, form)
        : await createClientLead(form);
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
          {/* Basic info */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Basic Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.client_name}
                  onChange={(e) => set("client_name", e.target.value)}
                  placeholder="e.g. Jatin Patel"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact No</label>
                <input
                  type="tel"
                  value={form.contact_no ?? ""}
                  onChange={(e) => set("contact_no", e.target.value)}
                  placeholder="9825000000"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Visit Date</label>
                <input
                  type="date"
                  value={form.first_visit_date ?? ""}
                  onChange={(e) => set("first_visit_date", e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Requirement (sqft)</label>
                <input
                  type="text"
                  value={form.requirement_sqft ?? ""}
                  onChange={(e) => set("requirement_sqft", e.target.value)}
                  placeholder="e.g. 2,000 sqft"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Material Category</label>
                <input
                  type="text"
                  value={form.material_category ?? ""}
                  onChange={(e) => set("material_category", e.target.value)}
                  placeholder="e.g. A quality, Ambaji Green"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Type</label>
                <input
                  type="text"
                  value={form.project_type ?? ""}
                  onChange={(e) => set("project_type", e.target.value)}
                  placeholder="e.g. Residential, Commercial"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source of Lead</label>
                <input
                  type="text"
                  value={form.source_of_lead ?? ""}
                  onChange={(e) => set("source_of_lead", e.target.value)}
                  placeholder="e.g. Walk-in, Referral, Instagram"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
                />
              </div>
              {/* Converted toggle */}
              <div className="col-span-2 flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.converted}
                  onClick={() => set("converted", !form.converted)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    form.converted ? "bg-green-500" : "bg-orange-400",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                      form.converted ? "translate-x-6" : "translate-x-1",
                    )}
                  />
                </button>
                <span className="text-sm font-medium text-gray-700">
                  {form.converted ? "Converted ✓" : "Not Converted"}
                </span>
              </div>
            </div>
          </section>

          {/* Architect & Contractor */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Architect & Contractor
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Architect Name</label>
                <input
                  type="text"
                  value={form.architect_name ?? ""}
                  onChange={(e) => set("architect_name", e.target.value)}
                  placeholder="Ar. Monil Gujar"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Architect Contact</label>
                <input
                  type="tel"
                  value={form.architect_contact ?? ""}
                  onChange={(e) => set("architect_contact", e.target.value)}
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
                  value={form.contractor_contact ?? ""}
                  onChange={(e) => set("contractor_contact", e.target.value)}
                  placeholder="9825000000"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Paid From</label>
                <input
                  type="text"
                  value={form.paid_from ?? ""}
                  onChange={(e) => set("paid_from", e.target.value)}
                  placeholder="e.g. Cash, Bank"
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

function CellValue({ col, lead }: { col: keyof ClientLead; lead: ClientLead }) {
  if (col === "converted") {
    return lead.converted ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        <CheckCircle2 className="h-3 w-3" /> Yes
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
        <XCircle className="h-3 w-3" /> No
      </span>
    );
  }

  if (col === "first_visit_date" && lead.first_visit_date) {
    return (
      <span className="whitespace-nowrap text-sm text-gray-600">
        {new Date(lead.first_visit_date).toLocaleDateString("en-IN")}
      </span>
    );
  }

  if (col === "contact_no" && lead.contact_no) {
    return (
      <a
        href={`tel:${lead.contact_no}`}
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline whitespace-nowrap"
        onClick={(e) => e.stopPropagation()}
      >
        <Phone className="h-3 w-3" />
        {lead.contact_no}
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

export function ClientLeads({ initialLeads }: ClientLeadsProps) {
  const [leads, setLeads] = useState<ClientLead[]>(initialLeads);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [drawerLead, setDrawerLead] = useState<ClientLead | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientLead | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [togglePendingId, setTogglePendingId] = useState<string | null>(null);
  const [filterConverted, setFilterConverted] = useState<"all" | "yes" | "no">("all");

  // Re-sync leads after server mutations (revalidatePath triggers re-render from parent)
  // The parent is a Server Component so it will refetch; here we just update local state
  // optimistically when the drawer closes.

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    let list = leads;

    if (filterConverted !== "all") {
      list = list.filter((l) =>
        filterConverted === "yes" ? l.converted : !l.converted,
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) =>
        [
          l.client_name,
          l.contact_no,
          l.material_category,
          l.requirement_sqft,
          l.architect_name,
          l.contractor_name,
          l.project_type,
          l.source_of_lead,
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
  }, [leads, search, filterConverted, sortKey, sortDir]);

  async function handleToggleConverted(lead: ClientLead) {
    setTogglePendingId(lead.id);
    const newVal = !lead.converted;
    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, converted: newVal } : l)),
    );
    const result = await toggleLeadConverted(lead.id, newVal);
    if (!result.success) {
      // Revert
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, converted: !newVal } : l)),
      );
    }
    setTogglePendingId(null);
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    startDelete(async () => {
      const result = await deleteClientLead(targetId);
      if (result.success) {
        setLeads((prev) => prev.filter((l) => l.id !== targetId));
      }
      setDeleteTarget(null);
    });
  }

  function handleDrawerClose() {
    setDrawerLead(null);
    // The parent Server Component will re-render from revalidatePath
    // but since this is fully client-side state for now, we rely on it.
    // In practice Next.js router refresh fires automatically via revalidatePath.
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Leads</h1>
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
        <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden text-sm font-medium">
          {(["all", "yes", "no"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilterConverted(v)}
              className={cn(
                "px-3 py-2 transition-colors",
                filterConverted === v
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-50",
              )}
            >
              {v === "all" ? "All" : v === "yes" ? "Converted" : "Not Converted"}
            </button>
          ))}
        </div>
        {filtered.length !== leads.length ? (
          <span className="text-sm text-gray-500">{filtered.length} shown</span>
        ) : null}
      </div>

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
                    "border-b border-gray-100 last:border-0 transition-colors hover:bg-gray-50",
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50/40",
                  )}
                >
                  {TABLE_COLS.map((col) => (
                    <td
                      key={col.key}
                      className="px-4 py-3"
                      onClick={
                        col.key === "converted"
                          ? () => handleToggleConverted(lead)
                          : undefined
                      }
                    >
                      {col.key === "converted" ? (
                        <button
                          type="button"
                          disabled={togglePendingId === lead.id}
                          className="cursor-pointer disabled:opacity-50"
                          onClick={() => handleToggleConverted(lead)}
                          title="Click to toggle"
                        >
                          {togglePendingId === lead.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                          ) : (
                            <CellValue col={col.key} lead={lead} />
                          )}
                        </button>
                      ) : (
                        <CellValue col={col.key} lead={lead} />
                      )}
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

      {/* Delete confirm */}
      {deleteTarget !== null ? (
        <DeleteConfirm
          name={deleteTarget.client_name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          loading={isDeleting}
        />
      ) : null}
    </div>
  );
}
