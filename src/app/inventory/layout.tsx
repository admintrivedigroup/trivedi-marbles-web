import type { ReactNode } from "react";

import "./fonts.css";
import "./tailwind.css";
import "./theme.css";

type InventoryLayoutProps = {
  children: ReactNode;
};

export default function InventoryLayout({ children }: InventoryLayoutProps) {
  return <div className="inventory-theme">{children}</div>;
}
