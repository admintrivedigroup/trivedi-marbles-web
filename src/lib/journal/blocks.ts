import type { ContentBlock, ContentBlockType } from "./types";

export function generateBlockId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `block-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Factory for a fresh, empty block of the given type — used by the "add
 * block" menu in the editor. Heading defaults to H2; use the level toggle
 * (or the H3-preset variant) to change it. */
export function createBlock(type: ContentBlockType, headingLevel: 2 | 3 = 2): ContentBlock {
  const id = generateBlockId();

  switch (type) {
    case "paragraph":
      return { id, type, data: { text: "" } };
    case "heading":
      return { id, type, data: { level: headingLevel, text: "" } };
    case "image":
      return { id, type, data: { url: "", alt: "" } };
    case "bulleted-list":
    case "numbered-list":
      return { id, type, data: { items: [""] } };
    case "quote":
      return { id, type, data: { text: "" } };
    case "comparison-table":
      return { id, type, data: { columns: ["", ""], rows: [["", ""]] } };
    case "key-takeaway":
      return { id, type, data: { text: "" } };
    case "product-card":
      return { id, type, data: { marbleLotId: "" } };
    case "project-card":
      return { id, type, data: { title: "" } };
    case "inquiry-cta":
      return {
        id,
        type,
        data: { heading: "", buttonLabel: "Enquire Now", destinationType: "whatsapp", destinationValue: "" },
      };
    case "faq-section":
      return { id, type, data: { faqs: [] } };
    case "video-embed":
      return { id, type, data: { provider: "youtube", url: "" } };
    default: {
      const exhaustive: never = type;
      throw new Error(`Unknown block type: ${exhaustive}`);
    }
  }
}
