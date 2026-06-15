import { notFound } from "next/navigation";
import { headers } from "next/headers";

import { getLotDetail } from "@/app/inventory/_lib/lot-detail";
import { LotLabel } from "@/app/inventory/_components/lot-labels";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function LotLabelsPage({ params }: Props) {
  const { id } = await params;
  const { lot, slabs, error } = await getLotDetail(id);

  if (error || !lot) {
    notFound();
  }

  const headersList = await headers();
  const forwardedHost = headersList.get("x-forwarded-host");
  const host = forwardedHost ?? headersList.get("host") ?? "localhost:3000";
  const proto =
    headersList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");

  const lotUrl = `${proto}://${host}/inventory/lot/${id}/view`;

  return <LotLabel lot={lot} lotUrl={lotUrl} slabCount={slabs.length} />;
}
