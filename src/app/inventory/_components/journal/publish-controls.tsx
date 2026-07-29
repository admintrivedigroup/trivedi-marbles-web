"use client";

import { Loader2 } from "lucide-react";

import type { ValidationIssues } from "@/lib/journal/validation";

export function PublishControls({
  isEditing,
  currentStatus,
  issues,
  isSaving,
  onSaveDraft,
  onSchedule,
  onPublish,
  onArchive,
  onPreview,
}: {
  isEditing: boolean;
  currentStatus: string;
  issues: ValidationIssues;
  isSaving: boolean;
  onSaveDraft: () => void;
  onSchedule: () => void;
  onPublish: () => void;
  onArchive: () => void;
  onPreview: () => void;
}) {
  const blocked = issues.errors.length > 0;

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5">
      {blocked ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          <p className="mb-1 font-medium">Fix before publishing or scheduling:</p>
          <ul className="list-disc space-y-0.5 pl-4">
            {issues.errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {issues.warnings.length > 0 ? (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <p className="mb-1 font-medium">Suggestions (won&apos;t block saving):</p>
          <ul className="list-disc space-y-0.5 pl-4">
            {issues.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={isSaving}
          className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Save Draft
        </button>
        <button
          type="button"
          onClick={onPreview}
          disabled={isSaving}
          className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Preview
        </button>
        <button
          type="button"
          onClick={onSchedule}
          disabled={isSaving || blocked}
          className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Schedule
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={isSaving || blocked}
          className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isEditing && currentStatus === "published" ? "Update" : "Publish"}
        </button>
        {isEditing && currentStatus !== "archived" ? (
          <button
            type="button"
            onClick={onArchive}
            disabled={isSaving}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Archive
          </button>
        ) : null}
      </div>
    </div>
  );
}
