"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  Settings,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { logout } from "@/app/inventory/_actions/auth";
import { cn } from "@/lib/utils";

type InventoryShellProps = {
  children: ReactNode;
  userEmail: string | null;
};

type NavigationItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  matchers: string[];
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
    matchers: ["/inventory/list", "/inventory/slab"],
  },
  {
    href: "/inventory/add",
    icon: Plus,
    label: "Add Stock",
    matchers: ["/inventory/add", "/inventory/edit"],
  },
  {
    href: "/inventory/movement",
    icon: ArrowLeftRight,
    label: "Movement",
    matchers: ["/inventory/movement"],
  },
  {
    href: "/inventory/quotations",
    icon: FileText,
    label: "Quotations",
    matchers: ["/inventory/quotations"],
  },
  {
    href: "/inventory/reports",
    icon: BarChart3,
    label: "Reports",
    matchers: ["/inventory/reports"],
  },
  {
    href: "/inventory/settings",
    icon: Settings,
    label: "Settings",
    matchers: ["/inventory/settings"],
  },
];

export function InventoryShell({ children, userEmail }: InventoryShellProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
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
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-300 lg:static",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <Link href="/inventory/dashboard" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#1f2937_0%,#4b5563_100%)]">
                <div className="h-6 w-6 rounded bg-white/20 backdrop-blur-sm" />
              </div>
              <div>
                <h1 className="font-bold text-gray-900">Marble Inventory</h1>
                <p className="text-xs text-gray-500">Premium Stones</p>
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

        <nav className="flex-1 space-y-1 p-4">
          {navigationItems.map((item) => {
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
                    ? "bg-gray-900 text-white shadow-lg"
                    : "text-gray-600 hover:bg-gray-100",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-200 p-4">
          {userEmail ? (
            <p className="mb-3 truncate px-4 text-xs text-gray-400">{userEmail}</p>
          ) : null}
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

      <main className="flex-1 overflow-auto">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-lg p-2 transition-colors hover:bg-gray-100"
          >
            <Menu className="h-6 w-6 text-gray-900" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#1f2937_0%,#4b5563_100%)]">
              <div className="h-5 w-5 rounded bg-white/20 backdrop-blur-sm" />
            </div>
            <span className="font-bold text-gray-900">Marble Inventory</span>
          </div>
        </div>

        <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
