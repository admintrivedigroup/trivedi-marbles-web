import { describe, expect, it } from "vitest";

import { buildBreadcrumbJsonLd, buildFaqJsonLd, safeJsonLdString } from "@/lib/journal/jsonld";
import type { ContentBlock } from "@/lib/journal/types";

function faqBlock(faqs: { id: string; question: string; answer: string }[]): ContentBlock {
  return { id: "faq", type: "faq-section", data: { faqs } };
}

describe("safeJsonLdString", () => {
  it("escapes < so a closing </script> tag can never be injected", () => {
    const result = safeJsonLdString({ text: "</script><script>alert(1)</script>" });
    expect(result).not.toContain("</script>");
    expect(result).toContain("\\u003c/script>");
  });
});

describe("buildFaqJsonLd", () => {
  const faqs = [{ id: "1", question: "Is it durable?", answer: "Yes, very." }];

  it("returns null when the post is not published", () => {
    expect(buildFaqJsonLd({ status: "draft" }, [faqBlock(faqs)])).toBeNull();
  });

  it("returns null when there are no FAQ blocks", () => {
    expect(buildFaqJsonLd({ status: "published" }, [])).toBeNull();
  });

  it("returns null when FAQ blocks exist but all entries are blank", () => {
    expect(buildFaqJsonLd({ status: "published" }, [faqBlock([{ id: "1", question: "", answer: "" }])])).toBeNull();
  });

  it("builds a FAQPage schema from valid, visible FAQs on a published post", () => {
    const schema = buildFaqJsonLd({ status: "published" }, [faqBlock(faqs)]);
    expect(schema).not.toBeNull();
    expect(schema?.["@type"]).toBe("FAQPage");
    expect(schema?.mainEntity).toHaveLength(1);
    expect(schema?.mainEntity[0].name).toBe("Is it durable?");
  });
});

describe("buildBreadcrumbJsonLd", () => {
  it("builds a positioned ListItem chain", () => {
    const schema = buildBreadcrumbJsonLd([
      { name: "Home", url: "https://example.com" },
      { name: "Journal", url: "https://example.com/journal" },
    ]);
    expect(schema.itemListElement).toHaveLength(2);
    expect(schema.itemListElement[0].position).toBe(1);
    expect(schema.itemListElement[1].position).toBe(2);
  });
});
