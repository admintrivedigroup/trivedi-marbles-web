"use client";

import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { LoaderCircle, X } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { StockLookupOption } from "@/app/inventory/_lib/stock";

export function PriceInput({
  disabled,
  id,
  label,
  name,
  onChange,
  value,
}: {
  disabled?: boolean;
  id: string;
  label: string;
  name: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
          Rs.
        </span>
        <input
          id={id}
          name={name}
          type="number"
          min="0"
          step="1"
          value={value}
          onChange={onChange}
          placeholder="0"
          disabled={disabled}
          className="w-full rounded-xl border border-gray-200 py-3 pl-9 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
        />
      </div>
    </div>
  );
}

export function AddOptionDialog({
  label,
  onClose,
  onSave,
}: {
  label: string;
  onClose: () => void;
  onSave: (name: string) => Promise<string | null>;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaveTransition] = useTransition();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startSaveTransition(async () => {
      const err = await onSave(name);
      if (err) setError(err);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-base font-bold text-gray-900">Add New {label}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-option-name" className="text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="add-option-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              placeholder={`Enter ${label.toLowerCase()} name`}
              disabled={isSaving}
              autoFocus
              className="rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isSaving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              Save
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ManageOptionsDialog({
  label,
  options,
  onClose,
  onDelete,
}: {
  label: string;
  options: StockLookupOption[];
  onClose: () => void;
  onDelete: (id: string) => Promise<string | null>;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StockLookupOption | null>(null);

  async function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    setDeletingId(id);
    setError(null);
    const err = await onDelete(id);
    if (err) setError(err);
    setDeletingId(null);
  }

  return (
    <>
      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Remove "${pendingDelete?.name}"?`}
        description="This option will be hidden from the dropdown. Existing slabs using it are not affected."
        confirmLabel="Remove"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <h3 className="mb-4 text-base font-bold text-gray-900">Manage {label} Options</h3>
          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
          {options.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No options available.</p>
          ) : (
            <ul className="mb-4 max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200">
              {options.map((option) => (
                <li key={option.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-800">{option.name}</span>
                  <button
                    type="button"
                    title={`Remove ${option.name}`}
                    onClick={() => setPendingDelete(option)}
                    disabled={deletingId !== null}
                    className="ml-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {deletingId === option.id ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
}
