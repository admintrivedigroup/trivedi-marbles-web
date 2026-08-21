"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import { updateDarkModePreference } from "@/app/inventory/_actions/profile";
import { cn } from "@/lib/utils";

type InventoryThemeContextValue = {
  isDark: boolean;
  toggleDark: () => void;
};

const InventoryThemeContext = createContext<InventoryThemeContextValue | null>(null);

export function InventoryThemeProvider({
  initialDark,
  children,
}: {
  initialDark: boolean;
  children: ReactNode;
}) {
  const [isDark, setIsDark] = useState(initialDark);

  async function toggleDark() {
    const next = !isDark;
    setIsDark(next);
    const res = await updateDarkModePreference(next);
    if (res.error) setIsDark(!next);
  }

  return (
    <InventoryThemeContext.Provider value={{ isDark, toggleDark }}>
      <div className={cn("inventory-theme", isDark && "dark")}>{children}</div>
    </InventoryThemeContext.Provider>
  );
}

export function useInventoryTheme() {
  const ctx = useContext(InventoryThemeContext);
  if (!ctx) {
    throw new Error("useInventoryTheme must be used within InventoryThemeProvider");
  }
  return ctx;
}
