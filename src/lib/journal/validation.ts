import type { ContentBlock, JournalPost } from "./types";
import { isValidSlug } from "./slug";
import {
  META_DESCRIPTION_RECOMMENDED_MAX,
  META_DESCRIPTION_RECOMMENDED_MIN,
  SEO_TITLE_RECOMMENDED_MAX,
  SEO_TITLE_RECOMMENDED_MIN,
  resolveMetaDescription,
  resolveSeoTitle,
} from "./seo-fallbacks";
import { isSafeUrl, isSafeWhatsAppUrl, parseVideoEmbedUrl } from "./sanitize-url";

export type ValidationIssues = { errors: string[]; warnings: string[] };

export type ValidatablePost = Pick<
  JournalPost,
  | "id"
  | "title"
  | "slug"
  | "category"
  | "excerpt"
  | "content"
  | "cover_image_url"
  | "cover_image_alt"
  | "seo_title"
  | "meta_description"
  | "canonical_url"
  | "social_image_url"
  | "focus_keyword"
  | "status"
  | "scheduled_at"
  | "published_at"
  | "related_post_ids"
>;

export function validateDraft(post: Pick<ValidatablePost, "title">): ValidationIssues {
  const errors: string[] = [];
  if (!post.title.trim()) errors.push("Title is required, even for a draft.");
  return { errors, warnings: [] };
}

function hasMeaningfulContent(content: ContentBlock[]): boolean {
  return content.some((block) => {
    switch (block.type) {
      case "paragraph":
      case "heading":
        return block.data.text.trim().length > 0;
      case "image":
        return block.data.url.trim().length > 0;
      case "bulleted-list":
      case "numbered-list":
        return block.data.items.some((item) => item.trim().length > 0);
      case "quote":
        return block.data.text.trim().length > 0;
      case "comparison-table":
        return block.data.rows.length > 0;
      case "key-takeaway":
        return block.data.text.trim().length > 0;
      case "product-card":
        return block.data.marbleLotId.trim().length > 0;
      case "project-card":
        return block.data.title.trim().length > 0;
      case "inquiry-cta":
        return block.data.heading.trim().length > 0;
      case "faq-section":
        return block.data.faqs.length > 0;
      case "video-embed":
        return block.data.url.trim().length > 0;
      default:
        return false;
    }
  });
}

export function hasH2(content: ContentBlock[]): boolean {
  return content.some((block) => block.type === "heading" && block.data.level === 2);
}

function textWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function wordCount(content: ContentBlock[]): number {
  let words = 0;
  for (const block of content) {
    if (block.type === "paragraph" || block.type === "heading" || block.type === "quote") {
      words += textWordCount(block.data.text);
    }
    if (block.type === "bulleted-list" || block.type === "numbered-list") {
      words += textWordCount(block.data.items.join(" "));
    }
    if (block.type === "key-takeaway") {
      words += textWordCount(block.data.text);
    }
  }
  return words;
}

/** Collects any unsafe/invalid URLs embedded in content blocks. */
export function findUnsafeBlockUrls(content: ContentBlock[]): string[] {
  const problems: string[] = [];
  for (const block of content) {
    if (block.type === "image" && block.data.url.trim() && !isSafeUrl(block.data.url)) {
      problems.push(`Image block has an unsafe or invalid URL.`);
    }
    if (block.type === "inquiry-cta" && block.data.destinationValue.trim()) {
      const ok =
        block.data.destinationType === "whatsapp"
          ? isSafeWhatsAppUrl(block.data.destinationValue)
          : isSafeUrl(block.data.destinationValue);
      if (!ok) problems.push(`Inquiry CTA block has an unsafe or invalid destination.`);
    }
    if (block.type === "video-embed" && block.data.url.trim() && !parseVideoEmbedUrl(block.data.url)) {
      problems.push(`Video embed block must be a valid YouTube or Vimeo URL.`);
    }
    if (block.type === "project-card" && block.data.url?.trim() && !isSafeUrl(block.data.url)) {
      problems.push(`Project card block has an unsafe or invalid URL.`);
    }
  }
  return problems;
}

export function validateForPublish(
  post: ValidatablePost,
  options: { existingSlugs?: Iterable<string> } = {},
): ValidationIssues {
  const errors: string[] = [];
  const warnings: string[] = [];
  const takenSlugs = new Set(options.existingSlugs ?? []);

  if (!post.title.trim()) errors.push("Title is required.");

  if (!post.slug || !isValidSlug(post.slug)) {
    errors.push("A valid URL slug is required.");
  } else if (takenSlugs.has(post.slug)) {
    errors.push("This slug is already used by another post.");
  }

  if (!post.category.trim()) errors.push("Category is required.");
  if (!post.excerpt.trim()) errors.push("Excerpt is required.");
  if (!hasMeaningfulContent(post.content)) {
    errors.push("At least one meaningful content block is required.");
  }
  if (post.cover_image_url.trim() && !post.cover_image_alt?.trim()) {
    errors.push("Cover image alt text is required when a cover image is set.");
  }
  if (!resolveSeoTitle(post).trim()) errors.push("SEO title (or a title fallback) is required.");
  if (!resolveMetaDescription(post).trim()) {
    errors.push("Meta description (or excerpt fallback) is required.");
  }

  if (post.status === "scheduled") {
    if (!post.scheduled_at) {
      errors.push("A scheduled date and time is required.");
    } else if (Number.isNaN(new Date(post.scheduled_at).getTime())) {
      errors.push("Scheduled date is invalid.");
    } else if (new Date(post.scheduled_at).getTime() <= Date.now()) {
      errors.push("Scheduled date must be in the future.");
    }
  }
  if (post.status === "published" && post.published_at && Number.isNaN(new Date(post.published_at).getTime())) {
    errors.push("Publish date is invalid.");
  }

  if (post.canonical_url?.trim() && !isSafeUrl(post.canonical_url)) {
    errors.push("Canonical URL is invalid.");
  }
  if (post.social_image_url?.trim() && !isSafeUrl(post.social_image_url)) {
    errors.push("Social sharing image URL is invalid.");
  }
  errors.push(...findUnsafeBlockUrls(post.content));

  const relatedIds = post.related_post_ids ?? [];
  if (new Set(relatedIds).size !== relatedIds.length) {
    errors.push("Related articles contain duplicate selections.");
  }
  if (relatedIds.includes(post.id)) {
    errors.push("An article cannot be related to itself.");
  }

  // Warnings never block saving/publishing.
  const seoTitle = resolveSeoTitle(post);
  if (seoTitle.length < SEO_TITLE_RECOMMENDED_MIN || seoTitle.length > SEO_TITLE_RECOMMENDED_MAX) {
    warnings.push(
      `SEO title is ${seoTitle.length} characters (recommended ${SEO_TITLE_RECOMMENDED_MIN}-${SEO_TITLE_RECOMMENDED_MAX}).`,
    );
  }
  const metaDescription = resolveMetaDescription(post);
  if (
    metaDescription.length < META_DESCRIPTION_RECOMMENDED_MIN ||
    metaDescription.length > META_DESCRIPTION_RECOMMENDED_MAX
  ) {
    warnings.push(
      `Meta description is ${metaDescription.length} characters (recommended ${META_DESCRIPTION_RECOMMENDED_MIN}-${META_DESCRIPTION_RECOMMENDED_MAX}).`,
    );
  }
  if (!post.focus_keyword?.trim()) warnings.push("Focus keyword is missing.");
  if (!hasH2(post.content)) warnings.push("Article has no H2 headings.");
  if (relatedIds.length === 0) warnings.push("Article has no internal links (related articles).");
  if (wordCount(post.content) < 200) warnings.push("Article is unusually short.");
  if (!post.cover_image_url.trim()) warnings.push("Cover image is missing.");
  if (!post.content.some((block) => block.type === "faq-section" && block.data.faqs.length > 0)) {
    warnings.push("FAQs are missing.");
  }

  return { errors, warnings };
}
