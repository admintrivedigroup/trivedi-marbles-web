export type Role = "superadmin" | "admin" | "staff";

export type Permission =
  | "add_stock"
  | "edit_stock"
  | "delete_stock"
  | "stock_movement"
  | "quotations"
  | "client_leads"
  | "settings"
  | "manage_users";

export const ALL_PERMISSIONS: Permission[] = [
  "add_stock",
  "edit_stock",
  "delete_stock",
  "stock_movement",
  "quotations",
  "client_leads",
  "settings",
  "manage_users",
];

export type ResolvedPermissions = Record<Permission, boolean>;

export const PERMISSION_LABELS: Record<Permission, string> = {
  add_stock: "Add Stock",
  edit_stock: "Edit Stock",
  delete_stock: "Delete Stock",
  stock_movement: "Stock Movement",
  quotations: "Quotations",
  client_leads: "Client Leads",
  settings: "Settings",
  manage_users: "Manage Users",
};

const ROLE_DEFAULTS: Record<Role, ResolvedPermissions> = {
  superadmin: {
    add_stock: true,
    edit_stock: true,
    delete_stock: true,
    stock_movement: true,
    quotations: true,
    client_leads: true,
    settings: true,
    manage_users: true,
  },
  admin: {
    add_stock: true,
    edit_stock: true,
    delete_stock: false,
    stock_movement: true,
    quotations: true,
    client_leads: true,
    settings: true,
    manage_users: false,
  },
  staff: {
    add_stock: false,
    edit_stock: false,
    delete_stock: false,
    stock_movement: true,
    quotations: true,
    client_leads: false,
    settings: false,
    manage_users: false,
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
