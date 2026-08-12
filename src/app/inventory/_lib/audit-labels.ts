// Human-readable labels for audit_logs.action values.
// Kept framework-agnostic (no "use client" / "server-only") so both
// server actions and client components can import it.

export const ACTION_LABELS: Record<string, string> = {
  // Slab
  "slab.created": "Slab Added",
  "slab.edited": "Slab Edited",
  "slab.status_changed": "Status Changed",
  "slab.deleted": "Slab Deleted",
  "slab.archived": "Slab Archived",
  "slab.restored": "Slab Restored",
  "slab.permanently_deleted": "Slab Permanently Deleted",
  "slab.image_uploaded": "Photo Added",
  "slab.image_deleted": "Photo Deleted",
  // Lot
  "lot.created": "Lot Created",
  "lot.edited": "Lot Edited",
  "lot.deleted": "Lot Deleted",
  "lot.archived": "Lot Archived",
  "lot.restored": "Lot Restored",
  "lot.permanently_deleted": "Lot Permanently Deleted",
  "lot.bulk_status_changed": "Bulk Status Change",
  // Movement / Transfer
  "movement.recorded": "Slab Moved",
  "movement.batch_recorded": "Slabs Moved (Batch)",
  "transfer.created": "Transfer Sent",
  "transfer.received": "Transfer Received",
  "transfer.cancelled": "Transfer Cancelled",
  // Quotation
  "quotation.pdf_downloaded": "Quotation PDF Downloaded",
  "quotation.whatsapp_shared": "Quotation Shared via WhatsApp",
  // User
  "user.invited": "User Invited",
  "user.role_changed": "User Role Changed",
  "user.permission_changed": "User Permission Changed",
  "user.removed": "User Removed",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}
