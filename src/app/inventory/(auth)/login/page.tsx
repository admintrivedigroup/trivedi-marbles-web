import type { Metadata } from "next";

import { InventoryLoginForm } from "@/app/inventory/_components/inventory-login-form";
import { redirectAuthenticatedInventoryUser } from "@/app/inventory/_lib/auth";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Inventory Login | Trivedi Marbles",
};

export default async function InventoryLoginPage() {
  await redirectAuthenticatedInventoryUser();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#f8fafc_0%,#f5f5f4_55%,#e7e5e4_100%)] p-4">
      <div className="w-full max-w-md">
        <InventoryLoginForm />
      </div>
    </div>
  );
}
