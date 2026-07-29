import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Looks up whether `slug` is a retired slug for a post that has since been
 * renamed, returning the current slug to redirect to (or null). The
 * journal_post_redirects table is infrastructure only in this phase — it is
 * populated going forward whenever a published post's slug changes, but is
 * not backfilled for the legacy posts, so this will return null until then.
 */
export async function findRedirectTargetSlug(oldSlug: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_post_redirects")
    .select("journal_posts(slug)")
    .eq("old_slug", oldSlug)
    .maybeSingle();

  if (error || !data) return null;

  const related = data.journal_posts as { slug: string | null } | { slug: string | null }[] | null;
  const post = Array.isArray(related) ? related[0] : related;
  return post?.slug ?? null;
}
