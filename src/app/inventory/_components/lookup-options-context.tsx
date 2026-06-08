"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

import type { LookupOptions, StockLookupOption } from "@/app/inventory/_lib/stock";
import type { LookupTableName } from "@/app/inventory/_actions/lookup-options";

type LookupOptionsContextValue = {
  options: LookupOptions;
  addOption: (table: LookupTableName, option: StockLookupOption) => void;
  removeOption: (table: LookupTableName, id: string) => void;
};

const LookupOptionsContext = createContext<LookupOptionsContextValue | null>(null);

function tableKey(table: LookupTableName): keyof LookupOptions {
  switch (table) {
    case "marble_categories": return "categories";
    case "slab_statuses": return "statuses";
    case "thickness_options": return "thicknesses";
    case "warehouses": return "warehouses";
  }
}

export function LookupOptionsProvider({
  children,
  initialOptions,
}: {
  children: ReactNode;
  initialOptions: LookupOptions;
}) {
  const [options, setOptions] = useState<LookupOptions>(initialOptions);

  function addOption(table: LookupTableName, option: StockLookupOption) {
    const key = tableKey(table);
    setOptions((prev) => ({ ...prev, [key]: [...prev[key], option] }));
  }

  function removeOption(table: LookupTableName, id: string) {
    const key = tableKey(table);
    setOptions((prev) => ({
      ...prev,
      [key]: prev[key].filter((o) => o.id !== id),
    }));
  }

  return (
    <LookupOptionsContext value={{ options, addOption, removeOption }}>
      {children}
    </LookupOptionsContext>
  );
}

export function useLookupOptions(): LookupOptionsContextValue {
  const ctx = useContext(LookupOptionsContext);
  if (!ctx) {
    throw new Error("useLookupOptions must be used within LookupOptionsProvider");
  }
  return ctx;
}
