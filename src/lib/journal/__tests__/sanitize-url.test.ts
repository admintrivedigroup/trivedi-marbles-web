import { describe, expect, it } from "vitest";

import { isSafeUrl, isSafeWhatsAppUrl, parseVideoEmbedUrl } from "@/lib/journal/sanitize-url";

describe("isSafeUrl", () => {
  it("accepts http/https/mailto/tel URLs", () => {
    expect(isSafeUrl("https://example.com")).toBe(true);
    expect(isSafeUrl("http://example.com")).toBe(true);
    expect(isSafeUrl("mailto:hello@example.com")).toBe(true);
    expect(isSafeUrl("tel:+911234567890")).toBe(true);
  });

  it("accepts root-relative internal paths and hash anchors", () => {
    expect(isSafeUrl("/collection/abc")).toBe(true);
    expect(isSafeUrl("#section")).toBe(true);
  });

  it("rejects javascript: and data: URLs", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("rejects blank or malformed input", () => {
    expect(isSafeUrl("")).toBe(false);
    expect(isSafeUrl("not a url")).toBe(false);
  });
});

describe("isSafeWhatsAppUrl", () => {
  it("accepts wa.me links", () => {
    expect(isSafeWhatsAppUrl("https://wa.me/911234567890")).toBe(true);
  });

  it("accepts a bare phone number", () => {
    expect(isSafeWhatsAppUrl("+91 12345 67890")).toBe(true);
  });

  it("rejects an unrelated domain", () => {
    expect(isSafeWhatsAppUrl("https://evil.example.com")).toBe(false);
  });
});

describe("parseVideoEmbedUrl", () => {
  it("parses standard YouTube watch URLs", () => {
    const result = parseVideoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result).toEqual({ provider: "youtube", embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" });
  });

  it("parses youtu.be short URLs", () => {
    const result = parseVideoEmbedUrl("https://youtu.be/dQw4w9WgXcQ");
    expect(result?.provider).toBe("youtube");
  });

  it("parses Vimeo URLs", () => {
    const result = parseVideoEmbedUrl("https://vimeo.com/123456789");
    expect(result).toEqual({ provider: "vimeo", embedUrl: "https://player.vimeo.com/video/123456789" });
  });

  it("rejects unapproved providers and arbitrary embed HTML", () => {
    expect(parseVideoEmbedUrl("https://example.com/video.mp4")).toBeNull();
    expect(parseVideoEmbedUrl("<iframe src='evil'></iframe>")).toBeNull();
    expect(parseVideoEmbedUrl("javascript:alert(1)")).toBeNull();
  });
});
