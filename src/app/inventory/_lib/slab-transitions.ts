// Pure rules for manual slab status changes. Shared by the single-slab,
// batch and whole-lot actions so they can't drift apart, and kept free of
// server-only imports so they can be unit-tested directly.
import { SLAB_STATUS } from "@/app/inventory/_lib/slab-status";

export type ManualStatus = typeof SLAB_STATUS.AVAILABLE | typeof SLAB_STATUS.RESERVED | typeof SLAB_STATUS.SOLD;

export type ReservationInput = {
  reservedFor: string;
  reservedUntil: string;
};

const MAX_CUSTOMER_NAME_LENGTH = 120;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's calendar date in India (YYYY-MM-DD), the business's timezone. Reservation
 * dates are plain dates with no time, so "today" has to be a date, not an instant. */
export function todayInIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Returns an error message, or null when the reservation is acceptable. */
export function validateReservation(
  data: ReservationInput | null | undefined,
  today: string = todayInIndia(),
): string | null {
  if (!data) return "Reservation details are required.";
  const name = data.reservedFor?.trim() ?? "";
  if (!name) return "Customer name is required to reserve.";
  if (name.length > MAX_CUSTOMER_NAME_LENGTH) {
    return `Customer name must be ${MAX_CUSTOMER_NAME_LENGTH} characters or fewer.`;
  }
  if (!isValidIsoDate(data.reservedUntil ?? "")) return "Reservation end date is invalid.";
  if (data.reservedUntil < today) return "Reservation end date can't be in the past.";
  return null;
}

/** Whether a user restricted to certain warehouses may act on a slab in `warehouseId`.
 * `allowed === null` means unrestricted. */
export function hasWarehouseAccess(allowed: string[] | null, warehouseId: string | null): boolean {
  if (allowed === null) return true;
  if (warehouseId === null) return false;
  return allowed.includes(warehouseId);
}

export type TransitionInput = {
  slabLabel: string;
  currentStatus: string | null;
  currentReservedFor: string | null;
  target: ManualStatus;
  /** Reservation being applied — only consulted when target is Reserved. */
  reservation?: ReservationInput | null;
  inTransit: boolean;
};

/** Returns an error message when the change isn't allowed, or null when it is.
 *
 * Allowed: Available → Reserved | Sold; Reserved → Sold | Available; Reserved → Reserved
 * only as a renewal for the same customer; Sold → Available (undoing a sale).
 * Everything else — including anything touching a slab in a pending transfer — is refused. */
export function checkSlabTransition(input: TransitionInput): string | null {
  const { slabLabel, currentStatus, target } = input;

  if (input.inTransit) {
    return `${slabLabel} is in a pending transfer — receive or cancel the transfer first.`;
  }

  if (
    currentStatus !== SLAB_STATUS.AVAILABLE &&
    currentStatus !== SLAB_STATUS.RESERVED &&
    currentStatus !== SLAB_STATUS.SOLD
  ) {
    return `${slabLabel} has status "${currentStatus ?? "unknown"}" which can't be changed here.`;
  }

  if (currentStatus === target) {
    if (target === SLAB_STATUS.RESERVED) {
      const holder = input.currentReservedFor?.trim().toLowerCase() ?? "";
      const requester = input.reservation?.reservedFor?.trim().toLowerCase() ?? "";
      if (holder && requester && holder === requester) return null;
      return `${slabLabel} is already reserved${input.currentReservedFor ? ` for ${input.currentReservedFor}` : ""} — release it before reserving for someone else.`;
    }
    return `${slabLabel} is already ${target.toLowerCase()}.`;
  }

  if (currentStatus === SLAB_STATUS.SOLD && target !== SLAB_STATUS.AVAILABLE) {
    return `${slabLabel} is sold — mark it available first if the sale was a mistake.`;
  }

  return null;
}

/** Column values to write for a status change. Reserved sets the reservation;
 * Available and Sold both clear it so a sold slab never keeps a stale hold. */
export function reservationColumns(
  target: ManualStatus,
  reservation: ReservationInput | null | undefined,
): { reserved_for: string | null; reserved_until: string | null } {
  if (target === SLAB_STATUS.RESERVED && reservation) {
    return { reserved_for: reservation.reservedFor.trim(), reserved_until: reservation.reservedUntil };
  }
  return { reserved_for: null, reserved_until: null };
}

export type ReservationState = "none" | "active" | "expiring_today" | "expired";

/** Classifies a reservation by calendar date. A reservation running until today is
 * still valid for the rest of today; only earlier dates are expired. */
export function classifyReservation(reservedUntil: string | null, today: string): ReservationState {
  if (!reservedUntil) return "none";
  const date = reservedUntil.slice(0, 10);
  if (date < today) return "expired";
  if (date === today) return "expiring_today";
  return "active";
}
