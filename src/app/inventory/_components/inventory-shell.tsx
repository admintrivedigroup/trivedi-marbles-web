"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  ArrowLeftRight,
  BookOpen,
  ClipboardList,
  Eye,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  ScanLine,
  Settings,
  UserSearch,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import dynamic from "next/dynamic";

import { logout } from "@/app/inventory/_actions/auth";
import { cn } from "@/lib/utils";

const QrScanner = dynamic(
  () => import("@/app/inventory/_components/qr-scanner").then((m) => ({ default: m.QrScanner })),
  { ssr: false },
);
import type { ResolvedPermissions, Role } from "@/app/inventory/_lib/permissions";

type InventoryShellProps = {
  children: ReactNode;
  userEmail: string | null;
  role: Role;
  permissions: ResolvedPermissions | null;
};

type NavigationItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  matchers: string[];
  permission?: keyof ResolvedPermissions;
  roles?: Role[];
};

const navigationItems: NavigationItem[] = [
  {
    href: "/inventory/dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
    matchers: ["/inventory/dashboard"],
  },
  {
    href: "/inventory/list",
    icon: Package,
    label: "Inventory",
    matchers: ["/inventory/list", "/inventory/slab", "/inventory/lot"],
  },
  {
    href: "/inventory/add",
    icon: Plus,
    label: "Add Stock",
    matchers: ["/inventory/add", "/inventory/edit"],
    permission: "add_stock",
  },
  {
    href: "/inventory/movement",
    icon: ArrowLeftRight,
    label: "Movement",
    matchers: ["/inventory/movement"],
    permission: "stock_movement",
  },
  {
    href: "/inventory/quotations",
    icon: FileText,
    label: "Quotations",
    matchers: ["/inventory/quotations"],
    permission: "quotations",
  },
  {
    href: "/inventory/settings",
    icon: Settings,
    label: "Settings",
    matchers: ["/inventory/settings"],
    permission: "settings",
  },
  {
    href: "/inventory/users",
    icon: Users,
    label: "Users",
    matchers: ["/inventory/users"],
    permission: "manage_users",
  },
  {
    href: "/inventory/audit",
    icon: ClipboardList,
    label: "Audit Log",
    matchers: ["/inventory/audit"],
    roles: ["admin", "superadmin"],
  },
  {
    href: "/inventory/archive",
    icon: Archive,
    label: "Archive",
    matchers: ["/inventory/archive"],
    roles: ["admin", "superadmin"],
  },
  {
    href: "/inventory/visualize",
    icon: Eye,
    label: "Visualizer",
    matchers: ["/inventory/visualize"],
  },
  {
    href: "/inventory/leads",
    icon: UserSearch,
    label: "Client Leads",
    matchers: ["/inventory/leads"],
    permission: "client_leads",
  },
  {
    href: "/inventory/journal",
    icon: BookOpen,
    label: "Journal",
    matchers: ["/inventory/journal"],
    roles: ["admin", "superadmin"],
  },
];

const ROLE_BADGE: Record<Role, { label: string; className: string }> = {
  superadmin: { label: "Super Admin", className: "bg-purple-100 text-purple-700" },
  admin: { label: "Admin", className: "bg-blue-100 text-blue-700" },
  staff: { label: "Staff", className: "bg-gray-100 text-gray-600" },
};

export function InventoryShell({
  children,
  userEmail,
  role,
  permissions,
}: InventoryShellProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const visibleItems = navigationItems.filter((item) => {
    if (item.roles && !item.roles.includes(role)) return false;
    if (!item.permission) return true;
    if (!permissions) return false;
    return permissions[item.permission];
  });

  const badge = ROLE_BADGE[role];

  return (
    <>
    {showScanner ? <QrScanner onClose={() => setShowScanner(false)} /> : null}
    <div className="flex min-h-screen bg-gray-50">
      {isSidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-300 lg:sticky lg:top-0 lg:shrink-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <Link href="/inventory/dashboard" className="flex items-center gap-2">
              <Image
                src="/images/vijay-trivedi-logo.webp"
                alt="Vijay Trivedi Group logo"
                width={48}
                height={48}
                className="h-9 w-9 shrink-0 object-contain"
              />
              <span className="h-7 w-px shrink-0 bg-gray-300" aria-hidden="true" />
              <Image
                src="/images/TRIVEDI MARBLES PVT.LTD.webp"
                alt="Trivedi Marbles Pvt. Ltd. logo"
                width={90}
                height={36}
                className="h-9 w-auto shrink-0 object-contain"
              />
              <div>
                <p className="text-xs text-gray-500">Marble Inventory</p>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="rounded-lg p-2 transition-colors hover:bg-gray-100 lg:hidden"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.matchers.some(
              (matcher) =>
                pathname === matcher || pathname.startsWith(`${matcher}/`),
            );

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setIsSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 transition-all",
                  isActive
                    ? "bg-gray-900 shadow-lg text-white! [&_span]:text-white! [&_svg]:text-white!"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-200 p-4">
          <div className="mb-3 px-4">
            {userEmail ? (
              <p className="truncate text-xs text-gray-400">{userEmail}</p>
            ) : null}
            <span
              className={cn(
                "mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                badge.className,
              )}
            >
              {badge.label}
            </span>
          </div>
<form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-gray-600 transition-all hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Logout</span>
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden bg-gray-50">
        <div className="sticky top-0 z-30 max-lg:flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-lg p-2 transition-colors hover:bg-gray-100"
          >
            <Menu className="h-6 w-6 text-gray-900" />
          </button>
          <div className="flex flex-1 items-center gap-2">
            <Image
              src="/images/vijay-trivedi-logo.webp"
              alt="Vijay Trivedi Group logo"
              width={40}
              height={40}
              className="h-8 w-8 shrink-0 object-contain"
            />
            <span className="h-6 w-px shrink-0 bg-gray-300" aria-hidden="true" />
            <Image
              src="/images/TRIVEDI MARBLES PVT.LTD.webp"
              alt="Trivedi Marbles Pvt. Ltd. logo"
              width={80}
              height={32}
              className="h-8 w-auto shrink-0 object-contain"
            />
            <span className="font-bold text-gray-900">Marble Inventory</span>
          </div>
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            aria-label="Scan QR code"
            className="rounded-lg p-2 transition-colors hover:bg-gray-100"
          >
            <ScanLine className="h-6 w-6 text-gray-900" />
          </button>
        </div>

        <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
    </>
  );
}
