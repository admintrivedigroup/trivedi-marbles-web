import { describe, expect, it } from "vitest";

import { validateDraft, validateForPublish, type ValidatablePost } from "@/lib/journal/validation";
import type { ContentBlock } from "@/lib/journal/types";

function paragraph(text: string): ContentBlock {
  return { id: "b1", type: "paragraph", data: { text } };
}

function heading(text: string, level: 2 | 3 = 2): ContentBlock {
  return { id: "b2", type: "heading", data: { level, text } };
}

function validPost(overrides: Partial<ValidatablePost> = {}): ValidatablePost {
  return {
    id: "post-1",
    title: "Understanding Ambaji Marble",
    slug: "understanding-ambaji-marble",
    category: "Ambaji Marble",
    excerpt: "A".repeat(150),
    content: [heading("Why it matters"), paragraph("word ".repeat(210))],
    cover_image_url: "https://example.com/cover.jpg",
    cover_image_alt: "A slab of Ambaji marble",
    seo_title: "Understanding Ambaji Marble ".padEnd(55, "x"),
    meta_description: "B".repeat(150),
    canonical_url: null,
    social_image_url: null,
    focus_keyword: "ambaji marble",
    status: "published",
    scheduled_at: null,
    published_at: new Date().toISOString(),
    related_post_ids: [],
    ...overrides,
  };
}

describe("validateDraft", () => {
  it("only requires a title", () => {
    expect(validateDraft({ title: "" }).errors).toContain("Title is required, even for a draft.");
    expect(validateDraft({ title: "Draft" }).errors).toHaveLength(0);
  });
});

describe("validateForPublish", () => {
  it("passes for a fully valid published post", () => {
    const { errors } = validateForPublish(validPost());
    expect(errors).toHaveLength(0);
  });

  it("requires title, slug, category, excerpt, and content", () => {
    const { errors } = validateForPublish(
      validPost({ title: "", slug: "", category: "", excerpt: "", content: [] }),
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        "Title is required.",
        "A valid URL slug is required.",
        "Category is required.",
        "Excerpt is required.",
        "At least one meaningful content block is required.",
      ]),
    );
  });

  it("rejects a slug already used by another post", () => {
    const { errors } = validateForPublish(validPost(), { existingSlugs: ["understanding-ambaji-marble"] });
    expect(errors).toContain("This slug is already used by another post.");
  });

  it("requires cover image alt text when a cover image is set", () => {
    const { errors } = validateForPublish(validPost({ cover_image_alt: null }));
    expect(errors).toContain("Cover image alt text is required when a cover image is set.");
  });

  it("does not require alt text when there is no cover image", () => {
    const { errors } = validateForPublish(validPost({ cover_image_url: "", cover_image_alt: null }));
    expect(errors).not.toContain("Cover image alt text is required when a cover image is set.");
  });

  it("requires a future scheduled date when status is scheduled", () => {
    const past = validateForPublish(
      validPost({ status: "scheduled", scheduled_at: new Date(Date.now() - 60_000).toISOString() }),
    );
    expect(past.errors).toContain("Scheduled date must be in the future.");

    const missing = validateForPublish(validPost({ status: "scheduled", scheduled_at: null }));
    expect(missing.errors).toContain("A scheduled date and time is required.");
  });

  it("rejects duplicate related-post selections", () => {
    const { errors } = validateForPublish(validPost({ related_post_ids: ["a", "a"] }));
    expect(errors).toContain("Related articles contain duplicate selections.");
  });

  it("rejects a self-referencing related article", () => {
    const { errors } = validateForPublish(validPost({ id: "post-1", related_post_ids: ["post-1"] }));
    expect(errors).toContain("An article cannot be related to itself.");
  });

  it("warns (without blocking) on a missing focus keyword, missing H2, and no internal links", () => {
    const { errors, warnings } = validateForPublish(
      validPost({ focus_keyword: null, content: [paragraph("short")], related_post_ids: [] }),
    );
    expect(errors).toHaveLength(0);
    expect(warnings).toContain("Focus keyword is missing.");
    expect(warnings).toContain("Article has no H2 headings.");
    expect(warnings).toContain("Article has no internal links (related articles).");
    expect(warnings).toContain("Article is unusually short.");
  });

  it("rejects an unsafe inquiry-cta destination", () => {
    const withUnsafeCta: ContentBlock = {
      id: "cta",
      type: "inquiry-cta",
      data: {
        heading: "Talk to us",
        buttonLabel: "Enquire",
        destinationType: "internal",
        destinationValue: "javascript:alert(1)",
      },
    };
    const { errors } = validateForPublish(validPost({ content: [heading("H"), withUnsafeCta] }));
    expect(errors.some((e) => e.includes("Inquiry CTA"))).toBe(true);
  });
});
