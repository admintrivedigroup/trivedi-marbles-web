export type JournalStatus = "draft" | "scheduled" | "published" | "archived";

export type RobotsDirective = "index-follow" | "noindex-follow" | "noindex-nofollow";

export type ParagraphBlockData = { text: string };
export type HeadingBlockData = { level: 2 | 3; text: string };
export type ImageBlockData = {
  url: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
};
export type ListBlockData = { items: string[] };
export type QuoteBlockData = { text: string; attribution?: string };
export type ComparisonTableBlockData = {
  caption?: string;
  columns: string[];
  rows: string[][];
};
export type KeyTakeawayBlockData = { title?: string; text: string };
export type ProductCardBlockData = { marbleLotId: string; note?: string };
export type ProjectCardBlockData = {
  title: string;
  imageUrl?: string;
  description?: string;
  url?: string;
};
export type InquiryCtaBlockData = {
  heading: string;
  body?: string;
  buttonLabel: string;
  destinationType: "internal" | "whatsapp";
  destinationValue: string;
};
export type Faq = { id: string; question: string; answer: string };
export type FaqSectionBlockData = { faqs: Faq[] };
export type VideoProvider = "youtube" | "vimeo";
export type VideoEmbedBlockData = {
  provider: VideoProvider;
  url: string;
  caption?: string;
};

export type ContentBlock =
  | { id: string; type: "paragraph"; data: ParagraphBlockData }
  | { id: string; type: "heading"; data: HeadingBlockData }
  | { id: string; type: "image"; data: ImageBlockData }
  | { id: string; type: "bulleted-list"; data: ListBlockData }
  | { id: string; type: "numbered-list"; data: ListBlockData }
  | { id: string; type: "quote"; data: QuoteBlockData }
  | { id: string; type: "comparison-table"; data: ComparisonTableBlockData }
  | { id: string; type: "key-takeaway"; data: KeyTakeawayBlockData }
  | { id: string; type: "product-card"; data: ProductCardBlockData }
  | { id: string; type: "project-card"; data: ProjectCardBlockData }
  | { id: string; type: "inquiry-cta"; data: InquiryCtaBlockData }
  | { id: string; type: "faq-section"; data: FaqSectionBlockData }
  | { id: string; type: "video-embed"; data: VideoEmbedBlockData };

export type ContentBlockType = ContentBlock["type"];

export type JournalCategory = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
};

export type JournalRelatedProduct = {
  marbleLotId: string;
  lotNumber?: string;
  marbleName?: string;
};

export type JournalRelatedArticle = {
  id: string;
  title: string;
  slug: string | null;
};

export type JournalPost = {
  id: string;
  title: string;
  slug: string | null;
  category: string;
  author_name: string;
  author_id: string | null;
  excerpt: string;
  cover_image_url: string;
  cover_image_alt: string | null;
  content: ContentBlock[];
  status: JournalStatus;
  is_featured: boolean;
  published_at: string | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  focus_keyword: string | null;
  secondary_keywords: string[];
  seo_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  social_title: string | null;
  social_description: string | null;
  social_image_url: string | null;
  robots_index: boolean;
  robots_follow: boolean;
  target_audience: string[];
  search_intent: string | null;
  date: string;
  related_product_ids: string[];
  related_post_ids: string[];
};

export const JOURNAL_STATUS_LABELS: Record<JournalStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};

export const CONTENT_BLOCK_LABELS: Record<ContentBlockType, string> = {
  paragraph: "Paragraph",
  heading: "Heading",
  image: "Image",
  "bulleted-list": "Bulleted List",
  "numbered-list": "Numbered List",
  quote: "Quote",
  "comparison-table": "Comparison Table",
  "key-takeaway": "Key Takeaway",
  "product-card": "Product Card",
  "project-card": "Project Card",
  "inquiry-cta": "Inquiry CTA",
  "faq-section": "FAQ Section",
  "video-embed": "Video Embed",
};
