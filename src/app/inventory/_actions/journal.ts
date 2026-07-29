"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { assertJournalManager } from "@/app/inventory/_lib/journal-auth";
import { validateDraft, validateForPublish, type ValidatablePost } from "@/lib/journal/validation";
import type { ContentBlock, JournalStatus } from "@/lib/journal/types";

export type JournalPostFormData = {
  title: string;
  slug: string;
  category: string;
  author_name: string;
  excerpt: string;
  cover_image_url: string;
  cover_image_alt: string;
  content: ContentBlock[];
  status: JournalStatus;
  is_featured: boolean;
  date: string;
  published_at: string | null;
  scheduled_at: string | null;
  focus_keyword: string;
  secondary_keywords: string[];
  seo_title: string;
  meta_description: string;
  canonical_url: string;
  social_title: string;
  social_description: string;
  social_image_url: string;
  robots_index: boolean;
  robots_follow: boolean;
  target_audience: string[];
  search_intent: string;
  related_product_ids: string[];
  related_post_ids: string[];
};

export type JournalActionResult =
  | { success: true; id: string }
  | { success: false; error: string; fieldErrors?: string[] };

function sanitize(data: JournalPostFormData) {
  return {
    title: data.title.trim(),
    slug: data.slug.trim() || null,
    category: data.category.trim(),
    author_name: data.author_name.trim() || "Trivedi Marbles Editorial Team",
    excerpt: data.excerpt.trim(),
    cover_image_url: data.cover_image_url.trim(),
    cover_image_alt: data.cover_image_alt.trim() || null,
    content: data.content,
    status: data.status,
    is_featured: Boolean(data.is_featured),
    date: data.date,
    published_at: data.published_at,
    scheduled_at: data.scheduled_at,
    focus_keyword: data.focus_keyword.trim() || null,
    secondary_keywords: data.secondary_keywords
      .slice(0, 5)
      .map((keyword) => keyword.trim())
      .filter(Boolean),
    seo_title: data.seo_title.trim() || null,
    meta_description: data.meta_description.trim() || null,
    canonical_url: data.canonical_url.trim() || null,
    social_title: data.social_title.trim() || null,
    social_description: data.social_description.trim() || null,
    social_image_url: data.social_image_url.trim() || null,
    robots_index: Boolean(data.robots_index),
    robots_follow: Boolean(data.robots_follow),
    target_audience: data.target_audience.map((audience) => audience.trim()).filter(Boolean),
    search_intent: data.search_intent.trim() || null,
  };
}

async function getOtherSlugs(excludeId?: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("journal_posts").select("id, slug");
  return (data ?? [])
    .filter((row) => row.slug && row.id !== excludeId)
    .map((row) => row.slug as string);
}

async function syncRelations(postId: string, relatedProductIds: string[], relatedPostIds: string[]) {
  const supabase = await createClient();
  await supabase.from("journal_post_related_products").delete().eq("journal_post_id", postId);
  await supabase.from("journal_post_related_articles").delete().eq("journal_post_id", postId);

  if (relatedProductIds.length > 0) {
    await supabase.from("journal_post_related_products").insert(
      relatedProductIds.map((marbleLotId, index) => ({
        journal_post_id: postId,
        marble_lot_id: marbleLotId,
        sort_order: index,
      })),
    );
  }
  if (relatedPostIds.length > 0) {
    await supabase.from("journal_post_related_articles").insert(
      relatedPostIds
        .filter((relatedId) => relatedId !== postId)
        .map((relatedId, index) => ({
          journal_post_id: postId,
          related_journal_post_id: relatedId,
          sort_order: index,
        })),
    );
  }
}

function validate(
  id: string,
  clean: ReturnType<typeof sanitize>,
  relatedPostIds: string[],
  existingSlugs: string[],
): string[] {
  if (clean.status === "published" || clean.status === "scheduled") {
    const { errors } = validateForPublish(
      { id, ...clean, related_post_ids: relatedPostIds } as ValidatablePost,
      { existingSlugs },
    );
    return errors;
  }
  return validateDraft(clean).errors;
}

export async function createJournalPost(data: JournalPostFormData): Promise<JournalActionResult> {
  await assertJournalManager();
  const clean = sanitize(data);

  const existingSlugs = await getOtherSlugs();
  const errors = validate("", clean, data.related_post_ids, existingSlugs);
  if (errors.length > 0) return { success: false, error: errors[0], fieldErrors: errors };

  const supabase = await createClient();
  const { data: row, error } = await supabase.from("journal_posts").insert([clean]).select("id").single();
  if (error) return { success: false, error: error.message };

  await syncRelations(row.id as string, data.related_product_ids, data.related_post_ids);

  revalidatePath("/inventory/journal");
  revalidatePath("/journal");
  return { success: true, id: row.id as string };
}

export async function updateJournalPost(id: string, data: JournalPostFormData): Promise<JournalActionResult> {
  await assertJournalManager();
  const clean = sanitize(data);

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("journal_posts")
    .select("slug, status")
    .eq("id", id)
    .maybeSingle();

  const existingSlugs = await getOtherSlugs(id);
  const errors = validate(id, clean, data.related_post_ids, existingSlugs);
  if (errors.length > 0) return { success: false, error: errors[0], fieldErrors: errors };

  const { error } = await supabase.from("journal_posts").update(clean).eq("id", id);
  if (error) return { success: false, error: error.message };

  // Never silently change a published post's slug: preserve the old one as a
  // redirect-history entry (the redirect itself isn't activated by this
  // alone — the public route consults this table when a slug isn't found).
  if (existing?.status === "published" && existing.slug && clean.slug && existing.slug !== clean.slug) {
    await supabase.from("journal_post_redirects").insert({ journal_post_id: id, old_slug: existing.slug });
  }

  await syncRelations(id, data.related_product_ids, data.related_post_ids);

  revalidatePath("/inventory/journal");
  revalidatePath("/journal");
  if (existing?.slug) revalidatePath(`/journal/${existing.slug}`);
  if (clean.slug) revalidatePath(`/journal/${clean.slug}`);
  return { success: true, id };
}

export async function archiveJournalPost(id: string): Promise<{ success: boolean; error?: string }> {
  await assertJournalManager();
  const supabase = await createClient();
  const { error } = await supabase.from("journal_posts").update({ status: "archived" }).eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/inventory/journal");
  revalidatePath("/journal");
  return { success: true };
}

export async function deleteJournalPost(id: string): Promise<{ success: boolean; error?: string }> {
  await assertJournalManager();
  const supabase = await createClient();
  const { error } = await supabase.from("journal_posts").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/inventory/journal");
  revalidatePath("/journal");
  return { success: true };
}
