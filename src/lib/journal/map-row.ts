import type { ContentBlock, JournalPost, JournalStatus } from "./types";

/** Shapes a raw Supabase `journal_posts` row into the app-facing JournalPost
 * type. Related product/article ids live in junction tables and are passed
 * in separately by callers that need them (the listing page doesn't). */
export function mapJournalPostRow(
  row: Record<string, unknown>,
  extra: { relatedProductIds?: string[]; relatedPostIds?: string[] } = {},
): JournalPost {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    slug: (row.slug as string | null) ?? null,
    category: String(row.category ?? ""),
    author_name: String(row.author_name ?? "Trivedi Marbles Editorial Team"),
    author_id: (row.author_id as string | null) ?? null,
    excerpt: String(row.excerpt ?? ""),
    cover_image_url: String(row.cover_image_url ?? ""),
    cover_image_alt: (row.cover_image_alt as string | null) ?? null,
    content: Array.isArray(row.content) ? (row.content as ContentBlock[]) : [],
    status: (row.status as JournalStatus) ?? "draft",
    is_featured: Boolean(row.is_featured),
    published_at: (row.published_at as string | null) ?? null,
    scheduled_at: (row.scheduled_at as string | null) ?? null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    updated_by: (row.updated_by as string | null) ?? null,
    focus_keyword: (row.focus_keyword as string | null) ?? null,
    secondary_keywords: Array.isArray(row.secondary_keywords) ? (row.secondary_keywords as string[]) : [],
    seo_title: (row.seo_title as string | null) ?? null,
    meta_description: (row.meta_description as string | null) ?? null,
    canonical_url: (row.canonical_url as string | null) ?? null,
    social_title: (row.social_title as string | null) ?? null,
    social_description: (row.social_description as string | null) ?? null,
    social_image_url: (row.social_image_url as string | null) ?? null,
    robots_index: row.robots_index !== false,
    robots_follow: row.robots_follow !== false,
    target_audience: Array.isArray(row.target_audience) ? (row.target_audience as string[]) : [],
    search_intent: (row.search_intent as string | null) ?? null,
    date: String(row.date ?? ""),
    related_product_ids: extra.relatedProductIds ?? [],
    related_post_ids: extra.relatedPostIds ?? [],
  };
}
