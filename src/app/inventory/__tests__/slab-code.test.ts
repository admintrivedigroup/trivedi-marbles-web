import { describe, expect, it } from "vitest";

import { renameSlabCode } from "@/app/inventory/_lib/slab-code";

describe("renameSlabCode", () => {
  it("swaps the lot prefix", () =>
    expect(renameSlabCode("FGP-116-S10", "FGP-116", "FBRP-116")).toBe("FBRP-116-S10"));
  it("handles surrounding whitespace in lot numbers", () =>
    expect(renameSlabCode("FGP-116-S1", " FGP-116 ", "FBRP-116 ")).toBe("FBRP-116-S1"));
  it("leaves custom codes alone", () =>
    expect(renameSlabCode("CUSTOM-1", "FGP-116", "FBRP-116")).toBeNull());
  it("does not match a longer lot number sharing the prefix", () =>
    expect(renameSlabCode("FGP-1160-S1", "FGP-116", "FBRP-116")).toBeNull());
  it("is a no-op when the lot number is unchanged", () =>
    expect(renameSlabCode("FGP-116-S1", "FGP-116", "FGP-116")).toBeNull());
  it("is a no-op when either lot number is empty", () => {
    expect(renameSlabCode("FGP-116-S1", "", "FBRP-116")).toBeNull();
    expect(renameSlabCode("FGP-116-S1", "FGP-116", "")).toBeNull();
  });
});
