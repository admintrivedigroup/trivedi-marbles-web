import type { MetadataRoute } from "next";

import type { JournalPost } from "./types";
import { isIndexableStatus, journalArticleUrl } from "./seo-fallbacks";

/** Pure filter, easy to unit test without touching Supabase: a post belongs
 * in the sitemap only if it has a slug, is actually indexable right now
 * (published + published_at not in the future), and robots_index is on. */
export function filterIndexableForSitemap(posts: JournalPost[]): JournalPost[] {
  return posts.filter((post) => Boolean(post.slug) && post.robots_index && isIndexableStatus(post));
}

/** Used by src/app/sitemap.ts to list indexable journal posts. */
export async function getJournalSitemapEntries(posts: JournalPost[]): Promise<MetadataRoute.Sitemap> {
  return filterIndexableForSitemap(posts).map((post) => ({
    url: journalArticleUrl(post.slug as string),
    lastModified: new Date(post.updated_at),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
}
