import { Suspense } from "react";
import type { Metadata } from "next";

import { InventoryResetPasswordForm } from "@/app/inventory/_components/inventory-reset-password-form";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Reset Password | Trivedi Marbles",
};

export default function InventoryResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#f8fafc_0%,#f5f5f4_55%,#e7e5e4_100%)] p-4">
      <div className="w-full max-w-md">
        <Suspense>
          <InventoryResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
