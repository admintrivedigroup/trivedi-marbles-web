import type { Metadata } from "next";
import type { ReactNode } from "react";

import { InventoryShell } from "@/app/inventory/_components/inventory-shell";
import { LookupOptionsProvider } from "@/app/inventory/_components/lookup-options-context";
import { requireInventoryClaims } from "@/app/inventory/_lib/auth";
import { getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";
import { getLookupOptions } from "@/app/inventory/_lib/lookup-options";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Inventory | Trivedi Marbles",
};

type InventoryAppLayoutProps = {
  children: ReactNode;
};

export default async function InventoryAppLayout({
  children,
}: InventoryAppLayoutProps) {
  const [claims, options, profile] = await Promise.all([
    requireInventoryClaims(),
    getLookupOptions(),
    getCurrentUserProfile(),
  ]);

  return (
    <LookupOptionsProvider initialOptions={options}>
      <InventoryShell
        userEmail={claims.email ?? null}
        role={profile?.role ?? "staff"}
        permissions={profile?.permissions ?? null}
      >
        {children}
      </InventoryShell>
    </LookupOptionsProvider>
  );
}
