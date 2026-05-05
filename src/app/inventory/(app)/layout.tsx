import type { Metadata } from "next";
import type { ReactNode } from "react";

import { InventoryShell } from "@/app/inventory/_components/inventory-shell";
import { requireInventoryClaims } from "@/app/inventory/_lib/auth";

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
  const claims = await requireInventoryClaims();

  return (
    <InventoryShell userEmail={claims.email ?? null}>
      {children}
    </InventoryShell>
  );
}
