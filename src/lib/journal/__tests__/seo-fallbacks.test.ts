import { describe, expect, it } from "vitest";

import {
  isIndexableStatus,
  journalArticleUrl,
  resolveCanonicalUrl,
  resolveMetaDescription,
  resolveRobots,
  resolveSeoTitle,
  resolveSocialDescription,
  resolveSocialImage,
  resolveSocialTitle,
} from "@/lib/journal/seo-fallbacks";

describe("SEO fallback chains", () => {
  it("falls back to the article title when seo_title is blank", () => {
    expect(resolveSeoTitle({ seo_title: null, title: "Article Title" })).toBe("Article Title");
    expect(resolveSeoTitle({ seo_title: "  ", title: "Article Title" })).toBe("Article Title");
    expect(resolveSeoTitle({ seo_title: "Custom SEO Title", title: "Article Title" })).toBe("Custom SEO Title");
  });

  it("falls back to the excerpt when meta_description is blank", () => {
    expect(resolveMetaDescription({ meta_description: null, excerpt: "Excerpt text" })).toBe("Excerpt text");
    expect(resolveMetaDescription({ meta_description: "Custom", excerpt: "Excerpt text" })).toBe("Custom");
  });

  it("chains social title through seo_title then title", () => {
    expect(resolveSocialTitle({ social_title: null, seo_title: null, title: "Title" })).toBe("Title");
    expect(resolveSocialTitle({ social_title: null, seo_title: "SEO", title: "Title" })).toBe("SEO");
    expect(resolveSocialTitle({ social_title: "Social", seo_title: "SEO", title: "Title" })).toBe("Social");
  });

  it("chains social description through meta_description then excerpt", () => {
    expect(
      resolveSocialDescription({ social_description: null, meta_description: null, excerpt: "Excerpt" }),
    ).toBe("Excerpt");
  });

  it("falls back social image to the cover image", () => {
    expect(resolveSocialImage({ social_image_url: null, cover_image_url: "cover.jpg" })).toBe("cover.jpg");
    expect(resolveSocialImage({ social_image_url: "social.jpg", cover_image_url: "cover.jpg" })).toBe("social.jpg");
  });

  it("defaults canonical URL to the final journal slug URL", () => {
    expect(resolveCanonicalUrl({ canonical_url: null, slug: "my-post" })).toBe(journalArticleUrl("my-post"));
    expect(resolveCanonicalUrl({ canonical_url: null, slug: null })).toBeNull();
    expect(resolveCanonicalUrl({ canonical_url: "https://custom.example/x", slug: "my-post" })).toBe(
      "https://custom.example/x",
    );
  });
});

describe("isIndexableStatus / resolveRobots", () => {
  it("is not indexable when draft, scheduled, or archived", () => {
    expect(isIndexableStatus({ status: "draft", published_at: null })).toBe(false);
    expect(isIndexableStatus({ status: "archived", published_at: new Date().toISOString() })).toBe(false);
  });

  it("is not indexable when published but published_at is in the future", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isIndexableStatus({ status: "published", published_at: future })).toBe(false);
  });

  it("is indexable when published and published_at has passed", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isIndexableStatus({ status: "published", published_at: past })).toBe(true);
  });

  it("forces noindex/nofollow regardless of stored preference when not indexable", () => {
    const robots = resolveRobots({
      status: "draft",
      published_at: null,
      robots_index: true,
      robots_follow: true,
    });
    expect(robots).toEqual({ index: false, follow: false });
  });

  it("uses the stored preference when the post is genuinely live", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const robots = resolveRobots({
      status: "published",
      published_at: past,
      robots_index: false,
      robots_follow: true,
    });
    expect(robots).toEqual({ index: false, follow: true });
  });
});
