import { isValidElement } from "react";
import { describe, expect, it } from "vitest";

import { parseInlineRichText } from "@/lib/journal/rich-text";

describe("parseInlineRichText", () => {
  it("returns plain text unchanged when there is no markup", () => {
    expect(parseInlineRichText("Just plain text.")).toEqual(["Just plain text."]);
  });

  it("renders **bold** as a <strong> element", () => {
    const nodes = parseInlineRichText("This is **bold** text.");
    const strongNode = nodes.find((node) => isValidElement(node) && node.type === "strong");
    expect(strongNode).toBeDefined();
    expect((strongNode as React.ReactElement<{ children: string }>).props.children).toBe("bold");
  });

  it("renders *italic* as an <em> element", () => {
    const nodes = parseInlineRichText("This is *italic* text.");
    const emNode = nodes.find((node) => isValidElement(node) && node.type === "em");
    expect(emNode).toBeDefined();
  });

  it("renders a safe [text](url) link as an <a> element", () => {
    const nodes = parseInlineRichText("See [our collection](/collection).");
    const anchor = nodes.find((node) => isValidElement(node) && node.type === "a");
    expect(anchor).toBeDefined();
    const props = (anchor as React.ReactElement<{ href: string; children: string }>).props;
    expect(props.href).toBe("/collection");
    expect(props.children).toBe("our collection");
  });

  it("drops an unsafe link URL down to plain text instead of rendering an <a>", () => {
    const nodes = parseInlineRichText("Click [here](javascript:alert(1)) now.");
    const anchor = nodes.find((node) => isValidElement(node) && node.type === "a");
    expect(anchor).toBeUndefined();
    expect(nodes).toContain("here");
  });

  it("adds target=_blank/rel=noopener only for external links, not internal ones", () => {
    const external = parseInlineRichText("[ext](https://example.com)").find(
      (node) => isValidElement(node) && node.type === "a",
    ) as React.ReactElement<{ target?: string }>;
    const internal = parseInlineRichText("[int](/page)").find(
      (node) => isValidElement(node) && node.type === "a",
    ) as React.ReactElement<{ target?: string }>;

    expect(external.props.target).toBe("_blank");
    expect(internal.props.target).toBeUndefined();
  });
});
