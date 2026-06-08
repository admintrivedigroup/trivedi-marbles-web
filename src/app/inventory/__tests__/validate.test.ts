import { describe, expect, it } from "vitest";

import {
  parseRequiredPositiveNumber,
  parseOptionalNonNegativeNumber,
} from "@/app/inventory/_lib/validate";

describe("parseRequiredPositiveNumber", () => {
  it("parses a valid positive number", () => {
    const result = parseRequiredPositiveNumber("5.5", "Length");
    expect(result.error).toBeNull();
    expect(result.value).toBeCloseTo(5.5);
  });

  it("rejects empty input", () => {
    const result = parseRequiredPositiveNumber("", "Width");
    expect(result.error).toMatch(/Width/);
    expect(result.value).toBeNull();
  });

  it("rejects zero", () => {
    const result = parseRequiredPositiveNumber("0", "Length");
    expect(result.error).toMatch(/greater than 0/i);
    expect(result.value).toBeNull();
  });

  it("rejects negative values", () => {
    const result = parseRequiredPositiveNumber("-3", "Width");
    expect(result.error).toMatch(/greater than 0/i);
    expect(result.value).toBeNull();
  });

  it("rejects non-numeric strings", () => {
    const result = parseRequiredPositiveNumber("abc", "Length");
    expect(result.error).not.toBeNull();
    expect(result.value).toBeNull();
  });
});

describe("parseOptionalNonNegativeNumber", () => {
  it("returns null value for empty input", () => {
    const result = parseOptionalNonNegativeNumber("", "Cost");
    expect(result.error).toBeNull();
    expect(result.value).toBeNull();
  });

  it("parses a valid non-negative number", () => {
    const result = parseOptionalNonNegativeNumber("100", "Cost");
    expect(result.error).toBeNull();
    expect(result.value).toBe(100);
  });

  it("allows zero", () => {
    const result = parseOptionalNonNegativeNumber("0", "Price");
    expect(result.error).toBeNull();
    expect(result.value).toBe(0);
  });

  it("rejects negative values", () => {
    const result = parseOptionalNonNegativeNumber("-1", "Price");
    expect(result.error).not.toBeNull();
    expect(result.value).toBeNull();
  });
});
