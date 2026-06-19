import type { ReactNode } from "react";

import { requireInventoryClaims } from "@/app/inventory/_lib/auth";

export default async function FullscreenLayout({ children }: { children: ReactNode }) {
  await requireInventoryClaims();
  return <>{children}</>;
}
