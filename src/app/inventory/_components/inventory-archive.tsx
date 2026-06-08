"use client";

import { useState, useTransition } from "react";
import { Archive, ChevronRight, Package, RotateCcw, Trash2 } from "lucide-react";

import { restoreSlab } from "@/app/inventory/_actions/restore-slab";
import { restoreLot } from "@/app/inventory/_actions/restore-lot";
import { permanentDeleteSlab, permanentDeleteLot } from "@/app/inventory/_actions/permanent-delete";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ArchivedLot, ArchivedSlab } from "@/app/inventory/_lib/archive";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type ActionButtonsProps = {
  label: string;
  restoreLabel?: string;
  deleteDescription?: string;
  onRestore: () => Promise<string | null>;
  onDelete: () => Promise<string | null>;
};

function ActionButtons({ label, restoreLabel, deleteDescription, onRestore, onDelete }: ActionButtonsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleRestore() {
    setError(null);
    startTransition(async () => {
      const err = await onRestore();
      if (err) setError(err);
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const err = await onDelete();
      if (err) setError(err);
    });
  }

  return (
    <>
      <ConfirmDialog
        open={confirmDelete}
        title={`Permanently delete "${label}"?`}
        description={deleteDescription ?? "This cannot be undone. All images and movement history will be erased."}
        confirmLabel="Delete Forever"
        onConfirm={() => { setConfirmDelete(false); handleDelete(); }}
        onCancel={() => setConfirmDelete(false)}
      />
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRestore}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {isPending ? "Working…" : (restoreLabel ?? "Restore")}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    </>
  );
}

type LotGroup = {
  lot: ArchivedLot;
  slabs: ArchivedSlab[];
};

export function InventoryArchive({
  slabs,
  lots,
  error,
}: {
  slabs: ArchivedSlab[];
  lots: ArchivedLot[];
  error: string | null;
}) {
  const [expandedLots, setExpandedLots] = useState<Set<string>>(new Set());

  function toggleLot(lotId: string) {
    setExpandedLots((prev) => {
      const next = new Set(prev);
      if (next.has(lotId)) next.delete(lotId);
      else next.add(lotId);
      return next;
    });
  }

  // Group archived slabs by their lot ID
  const archivedLotIds = new Set(lots.map((l) => l.id));
  const slabsByLot = new Map<string, ArchivedSlab[]>();
  const standaloneSlabs: ArchivedSlab[] = [];

  for (const slab of slabs) {
    if (slab.lotId && archivedLotIds.has(slab.lotId)) {
      const existing = slabsByLot.get(slab.lotId) ?? [];
      existing.push(slab);
      slabsByLot.set(slab.lotId, existing);
    } else {
      standaloneSlabs.push(slab);
    }
  }

  const lotGroups: LotGroup[] = lots.map((lot) => ({
    lot,
    slabs: slabsByLot.get(lot.id) ?? [],
  }));

  const hasContent = lots.length > 0 || standaloneSlabs.length > 0;

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 md:text-3xl">Archive</h1>
        <p className="text-gray-500">
          {lots.length} archived {lots.length === 1 ? "lot" : "lots"} &middot;{" "}
          {slabs.length} archived {slabs.length === 1 ? "slab" : "slabs"}
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!hasContent ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white px-6 py-16 text-center shadow-sm">
          <Archive className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-gray-500">Nothing archived yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Archived lots with their slabs */}
          {lotGroups.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              {lotGroups.map((group, groupIndex) => {
                const expanded = expandedLots.has(group.lot.id);
                return (
                  <div
                    key={group.lot.id}
                    className={groupIndex > 0 ? "border-t border-gray-100" : ""}
                  >
                    {/* Lot header row */}
                    <div className="flex items-center gap-3 bg-gray-50 px-4 py-3 md:px-6">
                      <button
                        type="button"
                        onClick={() => toggleLot(group.lot.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <ChevronRight
                          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
                        />
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 shrink-0 text-gray-400" />
                            <span className="font-mono text-sm font-bold text-gray-900">
                              {group.lot.lotNumber ?? "—"}
                            </span>
                          </div>
                          <span className="font-medium text-gray-800">
                            {group.lot.marbleName ?? "—"}
                          </span>
                          <span className="text-sm text-gray-400">·</span>
                          <span className="text-sm text-gray-500">
                            {group.slabs.length} {group.slabs.length === 1 ? "slab" : "slabs"}
                          </span>
                          <span className="text-sm text-gray-400">·</span>
                          <span className="text-xs text-gray-400">
                            Archived {formatDate(group.lot.deletedAt)}
                          </span>
                        </div>
                      </button>
                      <ActionButtons
                        label={group.lot.lotNumber ?? "lot"}
                        restoreLabel="Restore All"
                        deleteDescription={`This will permanently delete ${group.lot.lotNumber} and all its slabs. This cannot be undone.`}
                        onRestore={async () => {
                          const result = await restoreLot(group.lot.id);
                          return result.error;
                        }}
                        onDelete={async () => {
                          const result = await permanentDeleteLot(group.lot.id);
                          return result.error;
                        }}
                      />
                    </div>

                    {/* Slab rows inside the lot */}
                    {expanded && group.slabs.length > 0 && (
                      <div className="divide-y divide-gray-50">
                        {group.slabs.map((slab) => (
                          <div
                            key={slab.id}
                            className="flex items-center gap-3 bg-white py-3 pl-12 pr-4 md:pl-14 md:pr-6"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-mono text-sm font-semibold text-gray-900">
                                {slab.slabCode ?? "—"}
                              </span>
                              <p className="text-xs text-gray-400">
                                {slab.sqft != null ? `${slab.sqft} sqft` : "No dimensions"}
                              </p>
                            </div>
                            <ActionButtons
                              label={slab.slabCode ?? "slab"}
                              onRestore={async () => {
                                const result = await restoreSlab(slab.id);
                                return result.error;
                              }}
                              onDelete={async () => {
                                const result = await permanentDeleteSlab(slab.id);
                                return result.error;
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {expanded && group.slabs.length === 0 && (
                      <p className="py-4 pl-12 text-sm text-gray-400 md:pl-14">
                        No slabs in this lot.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Standalone archived slabs */}
          {standaloneSlabs.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Individual Slabs ({standaloneSlabs.length})
              </h2>
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <ul className="divide-y divide-gray-100">
                  {standaloneSlabs.map((slab) => (
                    <li
                      key={slab.id}
                      className="flex items-center justify-between gap-4 px-4 py-4 md:px-6"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-gray-900">
                            {slab.slabCode ?? "—"}
                          </span>
                          {slab.lotNumber ? (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                              {slab.lotNumber}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-sm text-gray-600">{slab.marbleName ?? "—"}</p>
                        <p className="text-xs text-gray-400">
                          {slab.sqft != null ? `${slab.sqft} sqft · ` : ""}
                          Archived {formatDate(slab.deletedAt)}
                        </p>
                      </div>
                      <ActionButtons
                        label={slab.slabCode ?? "slab"}
                        onRestore={async () => {
                          const result = await restoreSlab(slab.id);
                          return result.error;
                        }}
                        onDelete={async () => {
                          const result = await permanentDeleteSlab(slab.id);
                          return result.error;
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
