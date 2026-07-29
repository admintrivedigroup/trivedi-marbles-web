import { describe, expect, it } from "vitest";

import { filterIndexableForSitemap } from "@/lib/journal/sitemap";
import type { JournalPost } from "@/lib/journal/types";

function makePost(overrides: Partial<JournalPost>): JournalPost {
  return {
    id: "1",
    title: "Post",
    slug: "post",
    category: "Ambaji Marble",
    author_name: "Trivedi Marbles Editorial Team",
    author_id: null,
    excerpt: "Excerpt",
    cover_image_url: "",
    cover_image_alt: null,
    content: [],
    status: "published",
    is_featured: false,
    published_at: new Date(Date.now() - 60_000).toISOString(),
    scheduled_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    updated_by: null,
    focus_keyword: null,
    secondary_keywords: [],
    seo_title: null,
    meta_description: null,
    canonical_url: null,
    social_title: null,
    social_description: null,
    social_image_url: null,
    robots_index: true,
    robots_follow: true,
    target_audience: [],
    search_intent: null,
    date: "2026-01-01",
    related_product_ids: [],
    related_post_ids: [],
    ...overrides,
  };
}

describe("filterIndexableForSitemap", () => {
  it("includes a published post with a slug and robots_index on", () => {
    const posts = [makePost({})];
    expect(filterIndexableForSitemap(posts)).toHaveLength(1);
  });

  it("excludes drafts, scheduled, and archived posts", () => {
    const posts = [
      makePost({ status: "draft", published_at: null }),
      makePost({ status: "scheduled", published_at: null }),
      makePost({ status: "archived" }),
    ];
    expect(filterIndexableForSitemap(posts)).toHaveLength(0);
  });

  it("excludes a published post with no slug", () => {
    expect(filterIndexableForSitemap([makePost({ slug: null })])).toHaveLength(0);
  });

  it("excludes a published post whose published_at is in the future", () => {
    const future = makePost({ published_at: new Date(Date.now() + 60_000).toISOString() });
    expect(filterIndexableForSitemap([future])).toHaveLength(0);
  });

  it("excludes a noindex post even if published", () => {
    expect(filterIndexableForSitemap([makePost({ robots_index: false })])).toHaveLength(0);
  });
});
