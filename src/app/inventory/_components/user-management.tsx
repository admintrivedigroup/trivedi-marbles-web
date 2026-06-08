"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Mail,
  Shield,
  Trash2,
  UserPlus,
  Users,
  Warehouse,
  X,
} from "lucide-react";

import {
  inviteUser,
  removeUser,
  updateUserPermission,
  updateUserRole,
  updateUserWarehouseAccess,
} from "@/app/inventory/_actions/user-management";
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  getDefaultPermissions,
  type Permission,
  type Role,
  type ResolvedPermissions,
} from "@/app/inventory/_lib/permissions";
import type { ManagedUser } from "@/app/inventory/_lib/user-profile";
import type { StockLookupOption } from "@/app/inventory/_lib/stock";

type UserManagementProps = {
  users: ManagedUser[];
  warehouses: StockLookupOption[];
  currentUserId: string;
  currentRole: Role;
};

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "superadmin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "staff", label: "Staff" },
];

const ROLE_BADGE: Record<Role, string> = {
  superadmin: "bg-purple-100 text-purple-700",
  admin: "bg-blue-100 text-blue-700",
  staff: "bg-gray-100 text-gray-600",
};

function PermissionToggle({
  permission,
  enabled,
  isDefault,
  disabled,
  onToggle,
}: {
  permission: Permission;
  enabled: boolean;
  isDefault: boolean;
  disabled: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-700">{PERMISSION_LABELS[permission]}</span>
        {!isDefault && (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
            override
          </span>
        )}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onToggle(!enabled)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
          enabled ? "bg-gray-900" : "bg-gray-200"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function UserCard({
  user,
  warehouses,
  currentUserId,
  currentRole,
}: {
  user: ManagedUser;
  warehouses: StockLookupOption[];
  currentUserId: string;
  currentRole: Role;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const isSelf = user.userId === currentUserId;
  const canEdit = currentRole === "superadmin" || (currentRole === "admin" && user.role !== "superadmin");
  const defaults = getDefaultPermissions(user.role);

  function handleRoleChange(role: Role) {
    startTransition(async () => {
      const res = await updateUserRole(user.userId, role);
      if (res.error) setError(res.error);
    });
  }

  function handlePermissionToggle(permission: Permission, enabled: boolean) {
    startTransition(async () => {
      const res = await updateUserPermission(user.userId, permission, enabled);
      if (res.error) setError(res.error);
    });
  }

  function handleWarehouseToggle(warehouseId: string, checked: boolean) {
    const current = user.warehouseIds ?? [];
    const next = checked
      ? [...current, warehouseId]
      : current.filter((id) => id !== warehouseId);
    startTransition(async () => {
      const res = await updateUserWarehouseAccess(user.userId, next);
      if (res.error) setError(res.error);
    });
  }

  function handleRemove() {
    if (!confirmRemove) { setConfirmRemove(true); return; }
    startTransition(async () => {
      const res = await removeUser(user.userId);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      {/* Header row */}
      <div className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
          {(user.displayName ?? user.email).charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-gray-900">
            {user.displayName ?? "—"}
          </p>
          <p className="truncate text-sm text-gray-500">{user.email}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canEdit && !isSelf ? (
            <select
              value={user.role}
              disabled={isPending}
              onChange={(e) => handleRoleChange(e.target.value as Role)}
              className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed ${ROLE_BADGE[user.role]}`}
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_BADGE[user.role]}`}>
              {ROLE_OPTIONS.find((o) => o.value === user.role)?.label}
              {isSelf && " (you)"}
            </span>
          )}

          <button
            type="button"
            onClick={() => { setExpanded((v) => !v); setError(null); setConfirmRemove(false); }}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
          {isPending && (
            <div className="mb-3 flex items-center gap-2 text-xs text-gray-500">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              Saving...
            </div>
          )}
          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Permissions */}
          <div className="mb-4">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <Shield className="h-3.5 w-3.5" />
              Permissions
            </p>
            <div className="divide-y divide-gray-50">
              {ALL_PERMISSIONS.map((permission) => (
                <PermissionToggle
                  key={permission}
                  permission={permission}
                  enabled={user.permissions[permission]}
                  isDefault={user.permissions[permission] === defaults[permission]}
                  disabled={isPending || !canEdit || isSelf}
                  onToggle={(enabled) => handlePermissionToggle(permission, enabled)}
                />
              ))}
            </div>
          </div>

          {/* Warehouse access */}
          <div className="mb-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <Warehouse className="h-3.5 w-3.5" />
              Warehouse Access
            </p>
            <p className="mb-2 text-xs text-gray-500">
              {user.warehouseIds === null
                ? "Currently sees all warehouses."
                : `Restricted to ${user.warehouseIds.length} warehouse${user.warehouseIds.length !== 1 ? "s" : ""}.`}
              {" "}Uncheck all to allow all.
            </p>
            <div className="space-y-1.5">
              {warehouses.map((w) => {
                const checked = user.warehouseIds === null
                  ? false
                  : user.warehouseIds.includes(w.id);
                return (
                  <label key={w.id} className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isPending || !canEdit || isSelf}
                      onChange={(e) => handleWarehouseToggle(w.id, e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-800 disabled:cursor-not-allowed"
                    />
                    <span className="text-sm text-gray-700">{w.name}</span>
                    {checked && <Check className="h-3.5 w-3.5 text-gray-500" />}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Remove user */}
          {canEdit && !isSelf && (
            <div className="border-t border-gray-100 pt-3">
              {confirmRemove ? (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-red-600">Remove this user?</p>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleRemove}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {isPending ? <LoaderCircle className="h-3 w-3 animate-spin" /> : "Yes, remove"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(false)}
                    className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove user
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InvitePanel({
  warehouses,
  onClose,
}: {
  warehouses: StockLookupOption[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await inviteUser(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(true);
        setTimeout(onClose, 1500);
      }
    });
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">Invite User</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {success ? (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <Check className="h-4 w-4" />
          Invite sent successfully.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <input
              name="displayName"
              type="text"
              placeholder="Ramesh Patel"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                name="email"
                type="email"
                required
                placeholder="user@trivedi.com"
                className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Role</label>
            <select
              name="role"
              defaultValue="staff"
              className="w-full appearance-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {warehouses.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Warehouse Access
              </label>
              <p className="mb-2 text-xs text-gray-500">
                Leave all unchecked to allow access to all warehouses.
              </p>
              <div className="space-y-1.5">
                {warehouses.map((w) => (
                  <label key={w.id} className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      name="warehouseIds"
                      value={w.id}
                      className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-800"
                    />
                    <span className="text-sm text-gray-700">{w.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 text-sm font-medium text-white transition-all hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isPending ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Sending invite...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                Send Invite Email
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

export function UserManagement({
  users,
  warehouses,
  currentUserId,
  currentRole,
}: UserManagementProps) {
  const [showInvite, setShowInvite] = useState(false);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 md:mb-8">
        <div className="min-w-0">
          <h1 className="mb-1 text-2xl font-bold text-gray-900 md:text-3xl">Users</h1>
          <p className="text-gray-500">Manage team access and permissions</p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite((v) => !v)}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-gray-700"
        >
          <UserPlus className="h-4 w-4" />
          Invite User
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Users list */}
        <div className="min-w-0 space-y-3">
          {users.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-100 bg-white py-16 text-center text-gray-400 shadow-sm">
              <Users className="h-8 w-8" />
              <p className="text-sm">No users yet. Invite someone to get started.</p>
            </div>
          ) : (
            users.map((user) => (
              <UserCard
                key={user.userId}
                user={user}
                warehouses={warehouses}
                currentUserId={currentUserId}
                currentRole={currentRole}
              />
            ))
          )}
        </div>

        {/* Invite panel */}
        <div>
          {showInvite ? (
            <InvitePanel
              warehouses={warehouses}
              onClose={() => setShowInvite(false)}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center">
              <UserPlus className="mx-auto mb-3 h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-400">
                Click <strong className="text-gray-600">Invite User</strong> to add a team member.
                They&apos;ll receive an email to set their password.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
