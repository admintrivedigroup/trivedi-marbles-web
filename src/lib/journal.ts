import "server-only";

import { createClient } from "@/lib/supabase/server";
import { mapJournalPostRow } from "@/lib/journal/map-row";
import type { JournalPost } from "@/lib/journal/types";

async function attachRelations(supabase: Awaited<ReturnType<typeof createClient>>, postId: string) {
  const [productsRes, articlesRes] = await Promise.all([
    supabase
      .from("journal_post_related_products")
      .select("marble_lot_id")
      .eq("journal_post_id", postId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("journal_post_related_articles")
      .select("related_journal_post_id")
      .eq("journal_post_id", postId)
      .order("sort_order", { ascending: true }),
  ]);

  return {
    relatedProductIds: (productsRes.data ?? []).map((row) => String(row.marble_lot_id)),
    relatedPostIds: (articlesRes.data ?? []).map((row) => String(row.related_journal_post_id)),
  };
}

/** Public listing — only published posts whose published_at has passed. */
export async function getPublishedJournalPosts(): Promise<JournalPost[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("journal_posts")
      .select("*")
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false });

    if (error || !data) return [];
    return data.map((row) => mapJournalPostRow(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function getPublishedJournalPostBySlug(slug: string): Promise<JournalPost | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("journal_posts")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .maybeSingle();

    if (error || !data) return null;
    const relations = await attachRelations(supabase, data.id as string);
    return mapJournalPostRow(data as Record<string, unknown>, relations);
  } catch {
    return null;
  }
}

/**
 * Returns a post of ANY status by slug — used only by the admin-authenticated
 * draft-preview path in /journal/[slug]. Callers MUST verify the requester is
 * an authorized journal manager (requireJournalManager()) before using this;
 * it deliberately bypasses the published-only restriction.
 */
export async function getJournalPostBySlugForPreview(slug: string): Promise<JournalPost | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("journal_posts").select("*").eq("slug", slug).maybeSingle();

    if (error || !data) return null;
    const relations = await attachRelations(supabase, data.id as string);
    return mapJournalPostRow(data as Record<string, unknown>, relations);
  } catch {
    return null;
  }
}

export async function getRelatedArticleSummaries(ids: string[]): Promise<JournalPost[]> {
  if (ids.length === 0) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("journal_posts")
      .select("*")
      .in("id", ids)
      .eq("status", "published")
      .lte("published_at", new Date().toISOString());

    if (error || !data) return [];
    return data.map((row) => mapJournalPostRow(row as Record<string, unknown>));
  } catch {
    return [];
  }
}
