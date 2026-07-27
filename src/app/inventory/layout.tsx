import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./fonts.css";
import "./tailwind.css";
import "./theme.css";
import { PRIVATE_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  robots: PRIVATE_ROBOTS,
};

type InventoryLayoutProps = {
  children: ReactNode;
};

export default function InventoryLayout({ children }: InventoryLayoutProps) {
  return <div className="inventory-theme">{children}</div>;
}
