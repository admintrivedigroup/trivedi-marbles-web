const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isValidSlug(slug: string): boolean {
  if (!slug) return false;
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

/**
 * Given a desired base slug and the set of slugs already in use (excluding
 * the post being saved), returns a unique candidate by appending -2, -3, ...
 */
export function generateUniqueSlug(baseSlug: string, existingSlugs: Iterable<string>): string {
  const taken = new Set(existingSlugs);
  const base = baseSlug || "post";
  if (!taken.has(base)) return base;

  let suffix = 2;
  let candidate = `${base}-${suffix}`;
  while (taken.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}
