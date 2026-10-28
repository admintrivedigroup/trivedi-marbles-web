/**
 * Slab codes are generated as `<lot number>-S<n>` when slabs are created and
 * stored as plain text, so renaming a lot has to carry the new prefix over.
 * Returns the renamed code, or null when the code doesn't use the old lot
 * number as its prefix (custom codes are left alone).
 */
export function renameSlabCode(
  slabCode: string,
  oldLotNumber: string,
  newLotNumber: string,
): string | null {
  const oldPrefix = oldLotNumber.trim();
  const newPrefix = newLotNumber.trim();
  if (!oldPrefix || !newPrefix || oldPrefix === newPrefix) return null;
  if (!slabCode.startsWith(`${oldPrefix}-`)) return null;
  return `${newPrefix}${slabCode.slice(oldPrefix.length)}`;
}
