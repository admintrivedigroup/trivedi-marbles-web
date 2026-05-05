import type { ReactNode } from "react";

import { SupabaseConnectionTest } from "@/app/inventory/_components/supabase-connection-test";

import "./fonts.css";
import "./tailwind.css";
import "./theme.css";

type InventoryLayoutProps = {
  children: ReactNode;
};

export default function InventoryLayout({ children }: InventoryLayoutProps) {
  return (
    <div className="inventory-theme">
      <SupabaseConnectionTest />
      {children}
    </div>
  );
}
