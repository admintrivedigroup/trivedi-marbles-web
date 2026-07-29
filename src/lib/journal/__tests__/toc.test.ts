import { describe, expect, it } from "vitest";

import { buildHeadingIdsByBlockId, buildTableOfContents } from "@/lib/journal/toc";
import type { ContentBlock } from "@/lib/journal/types";

function heading(id: string, text: string, level: 2 | 3 = 2): ContentBlock {
  return { id, type: "heading", data: { level, text } };
}
function paragraph(id: string): ContentBlock {
  return { id, type: "paragraph", data: { text: "hello" } };
}

describe("buildTableOfContents", () => {
  it("extracts only H2/H3 blocks, ignoring other block types", () => {
    const toc = buildTableOfContents([paragraph("p1"), heading("h1", "Intro"), paragraph("p2")]);
    expect(toc).toEqual([{ id: "intro", text: "Intro", level: 2 }]);
  });

  it("skips headings with empty text", () => {
    const toc = buildTableOfContents([heading("h1", "   ")]);
    expect(toc).toHaveLength(0);
  });

  it("deduplicates identical heading text with numbered suffixes", () => {
    const toc = buildTableOfContents([
      heading("h1", "Overview"),
      heading("h2", "Overview"),
      heading("h3", "Overview"),
    ]);
    expect(toc.map((t) => t.id)).toEqual(["overview", "overview-2", "overview-3"]);
  });

  it("preserves heading level", () => {
    const toc = buildTableOfContents([heading("h1", "Main", 2), heading("h2", "Sub", 3)]);
    expect(toc.map((t) => t.level)).toEqual([2, 3]);
  });
});

describe("buildHeadingIdsByBlockId", () => {
  it("maps block id to the same slug ids used by buildTableOfContents", () => {
    const blocks = [heading("h1", "Overview"), heading("h2", "Overview")];
    const map = buildHeadingIdsByBlockId(blocks);
    const toc = buildTableOfContents(blocks);

    expect(map.get("h1")).toBe(toc[0].id);
    expect(map.get("h2")).toBe(toc[1].id);
  });
});
