export type Role = "superadmin" | "admin" | "staff";

export type Permission =
  | "view_dashboard"
  | "view_inventory"
  | "add_stock"
  | "edit_stock"
  | "delete_stock"
  | "stock_movement"
  | "view_tasks"
  | "view_task_calendar"
  | "view_kra"
  | "quotations"
  | "client_leads"
  | "view_visualizer"
  | "view_journal"
  | "manage_users"
  | "view_audit_log"
  | "view_archive"
  | "settings";

export const ALL_PERMISSIONS: Permission[] = [
  "view_dashboard",
  "view_inventory",
  "add_stock",
  "edit_stock",
  "delete_stock",
  "stock_movement",
  "view_tasks",
  "view_task_calendar",
  "view_kra",
  "quotations",
  "client_leads",
  "view_visualizer",
  "view_journal",
  "manage_users",
  "view_audit_log",
  "view_archive",
  "settings",
];

export type ResolvedPermissions = Record<Permission, boolean>;

export const PERMISSION_LABELS: Record<Permission, string> = {
  view_dashboard: "Dashboard",
  view_inventory: "Inventory",
  add_stock: "Add Stock",
  edit_stock: "Edit Stock",
  delete_stock: "Delete Stock",
  stock_movement: "Stock Movement",
  view_tasks: "Tasks",
  view_task_calendar: "Task Calendar",
  view_kra: "KRA / KPI",
  quotations: "Quotations",
  client_leads: "Client Leads",
  view_visualizer: "Visualizer",
  view_journal: "Journal",
  manage_users: "Manage Users",
  view_audit_log: "Audit Log",
  view_archive: "Archive",
  settings: "Settings",
};

const ROLE_DEFAULTS: Record<Role, ResolvedPermissions> = {
  superadmin: {
    view_dashboard: true,
    view_inventory: true,
    add_stock: true,
    edit_stock: true,
    delete_stock: true,
    stock_movement: true,
    view_tasks: true,
    view_task_calendar: true,
    view_kra: true,
    quotations: true,
    client_leads: true,
    view_visualizer: true,
    view_journal: true,
    manage_users: true,
    view_audit_log: true,
    view_archive: true,
    settings: true,
  },
  admin: {
    view_dashboard: true,
    view_inventory: true,
    add_stock: true,
    edit_stock: true,
    delete_stock: false,
    stock_movement: true,
    view_tasks: true,
    view_task_calendar: true,
    view_kra: true,
    quotations: true,
    client_leads: true,
    view_visualizer: true,
    view_journal: true,
    manage_users: false,
    view_audit_log: true,
    view_archive: true,
    settings: true,
  },
  staff: {
    view_dashboard: true,
    view_inventory: true,
    add_stock: false,
    edit_stock: false,
    delete_stock: false,
    stock_movement: true,
    view_tasks: true,
    view_task_calendar: true,
    view_kra: true,
    quotations: true,
    client_leads: false,
    view_visualizer: true,
    view_journal: false,
    manage_users: false,
    view_audit_log: false,
    view_archive: false,
    settings: false,
  },
};

export function getDefaultPermissions(role: Role): ResolvedPermissions {
  return { ...ROLE_DEFAULTS[role] };
}

export function resolvePermissions(
  role: Role,
  overrides: { permission: string; enabled: boolean }[],
): ResolvedPermissions {
  const resolved = getDefaultPermissions(role);
  for (const override of overrides) {
    if (override.permission in resolved) {
      resolved[override.permission as Permission] = override.enabled;
    }
  }
  return resolved;
}

export function isValidRole(value: unknown): value is Role {
  return value === "superadmin" || value === "admin" || value === "staff";
}
