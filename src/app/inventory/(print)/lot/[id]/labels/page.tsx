import { notFound } from "next/navigation";
import { headers } from "next/headers";

import { getLotDetail } from "@/app/inventory/_lib/lot-detail";
import { LotLabels } from "@/app/inventory/_components/lot-labels";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function LotLabelsPage({ params }: Props) {
  const { id } = await params;
  const { lot, slabs, error } = await getLotDetail(id);

  if (error || !lot) {
    notFound();
  }

  const availableSlabs = slabs.filter((s) => s.statusName === "Available");

  if (availableSlabs.length === 0) {
    return (
      <div className="inventory-theme flex min-h-screen items-center justify-center bg-gray-50 p-8 text-center">
        <div>
          <p className="text-lg font-semibold text-gray-700">No available slabs</p>
          <p className="mt-1 text-sm text-gray-400">
            All slabs in lot {lot.lotNumber ?? ""} have been reserved or sold.
          </p>
        </div>
      </div>
    );
  }

  const headersList = await headers();
  const forwardedHost = headersList.get("x-forwarded-host");
  const host = forwardedHost ?? headersList.get("host") ?? "localhost:3000";
  const proto =
    headersList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");

  return (
    <LotLabels
      lotNumber={lot.lotNumber}
      slabs={availableSlabs}
      baseUrl={`${proto}://${host}`}
    />
  );
}
