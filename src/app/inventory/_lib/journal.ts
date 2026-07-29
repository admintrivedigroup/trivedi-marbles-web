import "server-only";

import { createClient } from "@/lib/supabase/server";
import { mapJournalPostRow } from "@/lib/journal/map-row";
import type { JournalPost, JournalRelatedArticle, JournalRelatedProduct } from "@/lib/journal/types";

/** Full listing fetch — filtering/sorting/search happens client-side in
 * JournalManager since the dataset is small, mirroring how the previous
 * admin journal list worked. */
export async function getJournalPosts(): Promise<JournalPost[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_posts")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapJournalPostRow(row as Record<string, unknown>));
}

async function getRelatedProductIds(postId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("journal_post_related_products")
    .select("marble_lot_id")
    .eq("journal_post_id", postId)
    .order("sort_order", { ascending: true });
  return (data ?? []).map((row) => String(row.marble_lot_id));
}

async function getRelatedArticleIds(postId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("journal_post_related_articles")
    .select("related_journal_post_id")
    .eq("journal_post_id", postId)
    .order("sort_order", { ascending: true });
  return (data ?? []).map((row) => String(row.related_journal_post_id));
}

export async function getJournalPostById(id: string): Promise<JournalPost | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("journal_posts").select("*").eq("id", id).maybeSingle();

  if (error || !data) return null;

  const [relatedProductIds, relatedPostIds] = await Promise.all([
    getRelatedProductIds(id),
    getRelatedArticleIds(id),
  ]);

  return mapJournalPostRow(data as Record<string, unknown>, {
    relatedProductIds,
    relatedPostIds,
  });
}

export async function getRelatedProductOptions(): Promise<JournalRelatedProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marble_lots")
    .select("id, lot_number, marble_name")
    .eq("show_on_website", true)
    .is("deleted_at", null)
    .order("marble_name", { ascending: true });

  if (error || !data) return [];
  return data.map((row) => ({
    marbleLotId: String(row.id),
    lotNumber: row.lot_number != null ? String(row.lot_number) : undefined,
    marbleName: row.marble_name != null ? String(row.marble_name) : undefined,
  }));
}

export async function getRelatedArticleOptions(excludePostId?: string): Promise<JournalRelatedArticle[]> {
  const supabase = await createClient();
  let query = supabase.from("journal_posts").select("id, title, slug").order("title", { ascending: true });
  if (excludePostId) query = query.neq("id", excludePostId);

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    title: String(row.title ?? ""),
    slug: (row.slug as string | null) ?? null,
  }));
}
