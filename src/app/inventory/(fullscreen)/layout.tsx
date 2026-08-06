import type { ReactNode } from "react";

import { requireInventoryClaims } from "@/app/inventory/_lib/auth";
import { Toaster } from "@/app/inventory/_components/ui/sonner";

export default async function FullscreenLayout({ children }: { children: ReactNode }) {
  await requireInventoryClaims();
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
