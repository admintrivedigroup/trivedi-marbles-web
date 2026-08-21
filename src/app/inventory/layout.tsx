import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./fonts.css";
import "./tailwind.css";
import "./theme.css";
import { InventoryThemeProvider } from "@/app/inventory/_components/theme-provider";
import { getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";
import { PRIVATE_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  robots: PRIVATE_ROBOTS,
};

type InventoryLayoutProps = {
  children: ReactNode;
};

export default async function InventoryLayout({ children }: InventoryLayoutProps) {
  const profile = await getCurrentUserProfile();

  return (
    <InventoryThemeProvider initialDark={profile?.darkModeEnabled ?? false}>
      {children}
    </InventoryThemeProvider>
  );
}
