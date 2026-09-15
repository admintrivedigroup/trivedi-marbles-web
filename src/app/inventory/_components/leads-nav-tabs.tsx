"use client";

import Link from "next/link";
import { PencilRuler, UserSearch } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/inventory/leads", label: "Client Leads", value: "client", icon: UserSearch },
  { href: "/inventory/leads/architect", label: "Architect Leads", value: "architect", icon: PencilRuler },
] as const;

export function LeadsNavTabs({ active }: { active: "client" | "architect" }) {
  return (
    <div className="flex rounded-xl border border-gray-200 bg-white p-1 text-sm font-medium">
      {TABS.map(({ href, label, value, icon: Icon }) => (
        <Link
          key={value}
          href={href}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors",
            active === value
              ? "bg-gray-900 text-white"
              : "text-gray-600 hover:bg-gray-50",
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </div>
  );
}
