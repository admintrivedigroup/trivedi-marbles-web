// Canonical slab status names as stored in the slab_statuses table.
// Use these constants instead of inline string literals so a DB rename
// only needs updating in one place.
export const SLAB_STATUS = {
  AVAILABLE: "Available",
  RESERVED: "Reserved",
  SOLD: "Sold",
  IN_TRANSIT: "In Transit",
} as const;

export type SlabStatusName = (typeof SLAB_STATUS)[keyof typeof SLAB_STATUS];
