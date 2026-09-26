import { describe, expect, it } from "vitest";

import {
  checkSlabTransition,
  classifyReservation,
  hasWarehouseAccess,
  isValidIsoDate,
  reservationColumns,
  todayInIndia,
  validateReservation,
  type TransitionInput,
} from "@/app/inventory/_lib/slab-transitions";

const base: TransitionInput = {
  slabLabel: "S-1",
  currentStatus: "Available",
  currentReservedFor: null,
  target: "Reserved",
  reservation: { reservedFor: "Asha", reservedUntil: "2030-01-10" },
  inTransit: false,
};

describe("checkSlabTransition", () => {
  it("allows Available → Reserved", () => expect(checkSlabTransition(base)).toBeNull());
  it("allows Available → Sold", () =>
    expect(checkSlabTransition({ ...base, target: "Sold" })).toBeNull());
  it("allows Reserved → Sold", () =>
    expect(checkSlabTransition({ ...base, currentStatus: "Reserved", target: "Sold" })).toBeNull());
  it("allows Reserved → Available (release)", () =>
    expect(checkSlabTransition({ ...base, currentStatus: "Reserved", target: "Available" })).toBeNull());
  it("allows Sold → Available (undo a sale)", () =>
    expect(checkSlabTransition({ ...base, currentStatus: "Sold", target: "Available" })).toBeNull());

  it("refuses to reserve a sold slab", () =>
    expect(checkSlabTransition({ ...base, currentStatus: "Sold" })).toMatch(/sold/i));
  it("refuses to re-sell a sold slab", () =>
    expect(checkSlabTransition({ ...base, currentStatus: "Sold", target: "Sold" })).toMatch(/already sold/i));
  it("refuses Available → Available", () =>
    expect(checkSlabTransition({ ...base, target: "Available" })).toMatch(/already available/i));

  it("refuses to reserve a slab reserved for someone else, naming the holder", () => {
    const err = checkSlabTransition({
      ...base,
      currentStatus: "Reserved",
      currentReservedFor: "Ravi",
    });
    expect(err).toMatch(/already reserved for Ravi/);
  });

  it("allows renewing a reservation for the same customer (case/space-insensitive)", () =>
    expect(
      checkSlabTransition({
        ...base,
        currentStatus: "Reserved",
        currentReservedFor: "  asha ",
        reservation: { reservedFor: "ASHA", reservedUntil: "2030-02-01" },
      }),
    ).toBeNull());

  it("refuses when the slab is in a pending transfer, whatever the target", () => {
    for (const target of ["Available", "Reserved", "Sold"] as const) {
      expect(checkSlabTransition({ ...base, target, inTransit: true })).toMatch(/pending transfer/);
    }
  });

  it("refuses statuses it doesn't manage (e.g. In Transit, unknown)", () => {
    expect(checkSlabTransition({ ...base, currentStatus: "In Transit" })).toMatch(/can't be changed/);
    expect(checkSlabTransition({ ...base, currentStatus: null })).toMatch(/can't be changed/);
  });
});

describe("validateReservation", () => {
  const today = "2026-09-21";
  it("accepts today and future dates", () => {
    expect(validateReservation({ reservedFor: "A", reservedUntil: "2026-09-21" }, today)).toBeNull();
    expect(validateReservation({ reservedFor: "A", reservedUntil: "2027-01-01" }, today)).toBeNull();
  });
  it("rejects a past date", () =>
    expect(validateReservation({ reservedFor: "A", reservedUntil: "2026-09-20" }, today)).toMatch(/past/));
  it("rejects missing data", () => expect(validateReservation(null, today)).toMatch(/required/));
  it("rejects a blank customer name", () =>
    expect(validateReservation({ reservedFor: "   ", reservedUntil: "2027-01-01" }, today)).toMatch(/name/));
  it("rejects an over-long customer name", () =>
    expect(validateReservation({ reservedFor: "x".repeat(121), reservedUntil: "2027-01-01" }, today)).toMatch(
      /120/,
    ));
  it("rejects malformed and impossible dates", () => {
    expect(validateReservation({ reservedFor: "A", reservedUntil: "10/01/2027" }, today)).toMatch(/invalid/);
    expect(validateReservation({ reservedFor: "A", reservedUntil: "2027-02-30" }, today)).toMatch(/invalid/);
  });
});

describe("isValidIsoDate", () => {
  it("accepts real dates", () => expect(isValidIsoDate("2028-02-29")).toBe(true));
  it("rejects a non-leap Feb 29", () => expect(isValidIsoDate("2027-02-29")).toBe(false));
  it("rejects garbage", () => expect(isValidIsoDate("")).toBe(false));
});

describe("todayInIndia", () => {
  it("uses the India calendar date, not UTC", () => {
    // 20:00 UTC on the 20th is already 01:30 on the 21st in India.
    expect(todayInIndia(new Date("2026-09-20T20:00:00Z"))).toBe("2026-09-21");
    expect(todayInIndia(new Date("2026-09-20T12:00:00Z"))).toBe("2026-09-20");
  });
});

describe("reservationColumns", () => {
  const reservation = { reservedFor: " Asha ", reservedUntil: "2030-01-10" };
  it("sets the reservation (trimmed) when reserving", () =>
    expect(reservationColumns("Reserved", reservation)).toEqual({
      reserved_for: "Asha",
      reserved_until: "2030-01-10",
    }));
  it("clears it when marking Sold, so a sold slab keeps no stale hold", () =>
    expect(reservationColumns("Sold", reservation)).toEqual({ reserved_for: null, reserved_until: null }));
  it("clears it when marking Available", () =>
    expect(reservationColumns("Available", null)).toEqual({ reserved_for: null, reserved_until: null }));
});

describe("hasWarehouseAccess", () => {
  it("allows everything when unrestricted", () => expect(hasWarehouseAccess(null, "5")).toBe(true));
  it("allows a listed warehouse", () => expect(hasWarehouseAccess(["5", "6"], "5")).toBe(true));
  it("blocks an unlisted warehouse", () => expect(hasWarehouseAccess(["5"], "9")).toBe(false));
  it("blocks a slab with no warehouse for a restricted user", () =>
    expect(hasWarehouseAccess(["5"], null)).toBe(false));
});

describe("classifyReservation", () => {
  const today = "2026-09-21";
  it("treats no date as none", () => expect(classifyReservation(null, today)).toBe("none"));
  it("treats a past date as expired", () => expect(classifyReservation("2026-09-20", today)).toBe("expired"));
  it("treats today as expiring_today, not expired", () =>
    expect(classifyReservation("2026-09-21", today)).toBe("expiring_today"));
  it("treats a future date as active", () => expect(classifyReservation("2026-09-22", today)).toBe("active"));
  it("ignores a time component", () =>
    expect(classifyReservation("2026-09-21T00:00:00Z", today)).toBe("expiring_today"));
});
