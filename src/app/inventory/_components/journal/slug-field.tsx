"use client";

import { useEffect, useState } from "react";

import { slugify, isValidSlug } from "@/lib/journal/slug";
import { BASE_URL } from "@/lib/journal/seo-fallbacks";
import { Field, TextInput } from "./field-kit";

export function SlugField({
  title,
  slug,
  onSlugChange,
  existingSlugs,
}: {
  title: string;
  slug: string;
  onSlugChange: (slug: string) => void;
  existingSlugs: string[];
}) {
  const [locked, setLocked] = useState(false);

  // Auto-generates from the title until the admin manually edits the slug
  // field, at which point it stops overwriting their input.
  useEffect(() => {
    if (!locked) onSlugChange(slugify(title));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, locked]);

  const trimmed = slug.trim();
  const isDuplicate = trimmed.length > 0 && existingSlugs.includes(trimmed);
  const isValid = isValidSlug(trimmed);

  return (
    <Field label="URL Slug" required hint={`Preview: ${BASE_URL}/journal/${trimmed || "…"}`}>
      <TextInput
        value={slug}
        onChange={(e) => {
          setLocked(true);
          onSlugChange(e.target.value);
        }}
        onBlur={(e) => onSlugChange(slugify(e.target.value))}
      />
      {trimmed && !isValid ? (
        <p className="mt-1 text-xs text-red-600">Slug must be lowercase letters, numbers, and hyphens only.</p>
      ) : null}
      {isDuplicate ? <p className="mt-1 text-xs text-red-600">This slug is already used by another post.</p> : null}
    </Field>
  );
}
