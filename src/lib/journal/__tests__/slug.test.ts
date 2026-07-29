import { describe, expect, it } from "vitest";

import { generateUniqueSlug, isValidSlug, slugify } from "@/lib/journal/slug";

describe("slugify", () => {
  it("lowercases and kebab-cases a title", () => {
    expect(slugify("The Rise of Fusion Black")).toBe("the-rise-of-fusion-black");
  });

  it("strips punctuation and unsafe characters", () => {
    expect(slugify("What's New? (2026 Edition!)")).toBe("what-s-new-2026-edition");
  });

  it("collapses repeated separators and trims leading/trailing hyphens", () => {
    expect(slugify("  --Hello   World--  ")).toBe("hello-world");
  });

  it("handles accented characters", () => {
    expect(slugify("Café Ambají")).toBe("cafe-ambaji");
  });

  it("returns an empty string for input with no valid characters", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("isValidSlug", () => {
  it("accepts lowercase kebab-case slugs", () => {
    expect(isValidSlug("marble-selection-guide")).toBe(true);
  });

  it("rejects empty, uppercase, spaced, or malformed slugs", () => {
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("Marble-Guide")).toBe(false);
    expect(isValidSlug("marble guide")).toBe(false);
    expect(isValidSlug("-marble-guide")).toBe(false);
    expect(isValidSlug("marble--guide")).toBe(false);
  });
});

describe("generateUniqueSlug", () => {
  it("returns the base slug when it isn't taken", () => {
    expect(generateUniqueSlug("marble-guide", [])).toBe("marble-guide");
  });

  it("appends -2 on first collision", () => {
    expect(generateUniqueSlug("marble-guide", ["marble-guide"])).toBe("marble-guide-2");
  });

  it("finds the next free numbered suffix", () => {
    expect(generateUniqueSlug("marble-guide", ["marble-guide", "marble-guide-2", "marble-guide-3"])).toBe(
      "marble-guide-4",
    );
  });
});
