import { describe, expect, it } from "vitest";

import { toNum, toStr, relName, relLotNumber } from "@/app/inventory/_lib/normalize";

describe("toNum", () => {
  it("converts a number", () => expect(toNum(42)).toBe(42));
  it("converts a numeric string", () => expect(toNum("3.14")).toBeCloseTo(3.14));
  it("returns null for null", () => expect(toNum(null)).toBeNull());
  it("returns null for undefined", () => expect(toNum(undefined)).toBeNull());
  it("returns null for NaN string", () => expect(toNum("abc")).toBeNull());
  it("treats empty string as 0 (Number('') === 0)", () => expect(toNum("")).toBe(0));
});

describe("toStr", () => {
  it("trims and returns a string", () => expect(toStr("  hello  ")).toBe("hello"));
  it("returns null for non-string types", () => expect(toStr(7)).toBeNull());
  it("returns null for null", () => expect(toStr(null)).toBeNull());
  it("returns null for undefined", () => expect(toStr(undefined)).toBeNull());
  it("returns null for empty-after-trim string", () => expect(toStr("   ")).toBeNull());
});

describe("relName", () => {
  it("extracts name from object", () => expect(relName({ name: "Marble" })).toBe("Marble"));
  it("extracts name from array", () => expect(relName([{ name: "Granite" }])).toBe("Granite"));
  it("returns null for missing name", () => expect(relName({})).toBeNull());
  it("returns null for null", () => expect(relName(null)).toBeNull());
  it("returns null for empty array", () => expect(relName([])).toBeNull());
});

describe("relLotNumber", () => {
  it("extracts lot_number from object", () =>
    expect(relLotNumber({ lot_number: "LOT001" })).toBe("LOT001"));
  it("extracts lot_number from array", () =>
    expect(relLotNumber([{ lot_number: "LOT002" }])).toBe("LOT002"));
  it("returns null for null", () => expect(relLotNumber(null)).toBeNull());
  it("returns null for empty array", () => expect(relLotNumber([])).toBeNull());
});
