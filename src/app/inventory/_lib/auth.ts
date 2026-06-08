import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type InventoryClaims = {
  email?: string;
  role?: string;
  sub?: string;
};

export const getInventoryClaims = cache(async (): Promise<InventoryClaims | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error) {
    return null;
  }

  return (data?.claims as InventoryClaims | undefined) ?? null;
});

export async function requireInventoryClaims() {
  const claims = await getInventoryClaims();

  if (!claims?.sub) {
    redirect("/inventory/login");
  }

  return claims;
}

export async function redirectAuthenticatedInventoryUser(next?: string) {
  const claims = await getInventoryClaims();

  if (claims?.sub) {
    const safePath = next?.startsWith("/inventory/") ? next : "/inventory/dashboard";
    redirect(safePath);
  }
}
