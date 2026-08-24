import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { InventoryLoginForm } from "@/app/inventory/_components/inventory-login-form";
import { redirectAuthenticatedInventoryUser } from "@/app/inventory/_lib/auth";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: { absolute: "Inventory Login | Trivedi Marbles" },
};

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function InventoryLoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  await redirectAuthenticatedInventoryUser(next);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <Image
        src="/images/fusionblack_honed.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_0%,rgba(179,135,74,0.14),transparent_55%),linear-gradient(155deg,rgba(12,9,6,0.55)_0%,rgba(12,9,6,0.8)_78%)]" />
      <div className="relative w-full max-w-md">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-2 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[#f2ece0]/80 transition-colors hover:text-[#dcbc8a]"
        >
          <ArrowLeft className="size-3.5" />
          Back to Home
        </Link>
        <InventoryLoginForm next={next} />
      </div>
    </div>
  );
}
