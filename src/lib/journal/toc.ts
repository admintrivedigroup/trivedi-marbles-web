import { slugify } from "./slug";
import type { ContentBlock } from "./types";

export type TocEntry = { id: string; text: string; level: 2 | 3 };

/**
 * Extracts H2/H3 heading blocks and generates stable, deduplicated heading
 * IDs (kebab-case from the heading text, `-2`/`-3` suffix on collision).
 * The same IDs must be used both here and when rendering the blocks so that
 * table-of-contents links always resolve.
 */
export function buildTableOfContents(content: ContentBlock[]): TocEntry[] {
  const seen = new Map<string, number>();
  const entries: TocEntry[] = [];

  for (const block of content) {
    if (block.type !== "heading") continue;
    const text = block.data.text.trim();
    if (!text) continue;

    const base = slugify(text) || "section";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;

    entries.push({ id, text, level: block.data.level });
  }

  return entries;
}

/** Returns the same id->heading-block mapping used by buildTableOfContents,
 * keyed by block id, so the renderer can attach `id=` to the right element
 * without re-deriving slugs independently. */
export function buildHeadingIdsByBlockId(content: ContentBlock[]): Map<string, string> {
  const seen = new Map<string, number>();
  const map = new Map<string, string>();

  for (const block of content) {
    if (block.type !== "heading") continue;
    const text = block.data.text.trim();
    const base = slugify(text) || "section";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;
    map.set(block.id, id);
  }

  return map;
}
