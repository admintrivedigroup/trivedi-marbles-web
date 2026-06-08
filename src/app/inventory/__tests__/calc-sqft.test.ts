import { describe, expect, it } from "vitest";

import { calcSqft } from "@/app/inventory/_components/add-stock-slab-grid";

describe("calcSqft", () => {
  it("multiplies length by width", () => expect(calcSqft("5", "3")).toBe("15.00"));
  it("returns 0.00 when length is 0", () => expect(calcSqft("0", "5")).toBe("0.00"));
  it("returns 0.00 when width is 0", () => expect(calcSqft("5", "0")).toBe("0.00"));
  it("returns 0.00 for empty strings", () => expect(calcSqft("", "")).toBe("0.00"));
  it("handles decimal values", () => expect(calcSqft("4.5", "2.2")).toBe("9.90"));
  it("returns 0.00 for negative length", () => expect(calcSqft("-1", "5")).toBe("0.00"));
});
