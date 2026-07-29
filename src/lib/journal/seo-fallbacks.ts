export const BASE_URL = "https://www.trivedimarbles.co.in";

export function journalArticleUrl(slug: string): string {
  return `${BASE_URL}/journal/${slug}`;
}

export function resolveSeoTitle(post: { seo_title: string | null; title: string }): string {
  return post.seo_title?.trim() || post.title;
}

export function resolveMetaDescription(post: {
  meta_description: string | null;
  excerpt: string;
}): string {
  return post.meta_description?.trim() || post.excerpt;
}

export function resolveSocialTitle(post: {
  social_title: string | null;
  seo_title: string | null;
  title: string;
}): string {
  return post.social_title?.trim() || resolveSeoTitle(post);
}

export function resolveSocialDescription(post: {
  social_description: string | null;
  meta_description: string | null;
  excerpt: string;
}): string {
  return post.social_description?.trim() || resolveMetaDescription(post);
}

export function resolveSocialImage(post: {
  social_image_url: string | null;
  cover_image_url: string;
}): string {
  return post.social_image_url?.trim() || post.cover_image_url;
}

export function resolveCanonicalUrl(post: {
  canonical_url: string | null;
  slug: string | null;
}): string | null {
  if (post.canonical_url?.trim()) return post.canonical_url.trim();
  return post.slug ? journalArticleUrl(post.slug) : null;
}

/**
 * Whether a post is allowed to be indexed at all, independent of its stored
 * robots preference: draft, archived, and not-yet-live scheduled posts must
 * never be indexable regardless of what the admin selected in the SEO panel.
 */
export function isIndexableStatus(post: {
  status: "draft" | "scheduled" | "published" | "archived";
  published_at: string | null;
}): boolean {
  if (post.status !== "published") return false;
  if (!post.published_at) return false;
  return new Date(post.published_at).getTime() <= Date.now();
}

export function resolveRobots(post: {
  status: "draft" | "scheduled" | "published" | "archived";
  published_at: string | null;
  robots_index: boolean;
  robots_follow: boolean;
}): { index: boolean; follow: boolean } {
  if (!isIndexableStatus(post)) return { index: false, follow: false };
  return { index: post.robots_index, follow: post.robots_follow };
}

export const EXCERPT_RECOMMENDED_MIN = 140;
export const EXCERPT_RECOMMENDED_MAX = 220;
export const SEO_TITLE_RECOMMENDED_MIN = 50;
export const SEO_TITLE_RECOMMENDED_MAX = 60;
export const META_DESCRIPTION_RECOMMENDED_MIN = 140;
export const META_DESCRIPTION_RECOMMENDED_MAX = 160;
export const MAX_SECONDARY_KEYWORDS = 5;
