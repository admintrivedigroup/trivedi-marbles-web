import type { ContentBlock, JournalPost } from "./types";
import { journalArticleUrl } from "./seo-fallbacks";

const SITE_NAME = "Trivedi Marbles Pvt. Ltd.";
const SITE_URL = "https://www.trivedimarbles.co.in";
const LOGO_URL = `${SITE_URL}/images/vijay-trivedi-logo.webp`;

/**
 * Escapes `<` so this can never be interpreted as a closing `</script>` tag
 * (or any other markup) when embedded via dangerouslySetInnerHTML.
 */
export function safeJsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function buildArticleJsonLd(
  post: Pick<
    JournalPost,
    "title" | "excerpt" | "slug" | "cover_image_url" | "author_name" | "published_at" | "updated_at"
  >,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    ...(post.slug ? { mainEntityOfPage: journalArticleUrl(post.slug) } : {}),
    ...(post.cover_image_url ? { image: post.cover_image_url } : {}),
    ...(post.published_at ? { datePublished: post.published_at } : {}),
    dateModified: post.updated_at,
    author: { "@type": "Organization", name: post.author_name || SITE_NAME, url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: LOGO_URL },
    },
  };
}

export function buildBreadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

function extractVisibleFaqs(content: ContentBlock[]) {
  return content
    .filter((block): block is Extract<ContentBlock, { type: "faq-section" }> => block.type === "faq-section")
    .flatMap((block) => block.data.faqs)
    .filter((faq) => faq.question.trim().length > 0 && faq.answer.trim().length > 0);
}

/**
 * Only returns a schema when the article is published AND at least one
 * valid FAQ exists — the same faqs array that feeds the visible FAQ section
 * on the page, so schema never describes hidden/undisplayed content.
 */
export function buildFaqJsonLd(post: Pick<JournalPost, "status">, content: ContentBlock[]) {
  if (post.status !== "published") return null;

  const faqs = extractVisibleFaqs(content);
  if (faqs.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}
