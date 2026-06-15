import { notFound } from "next/navigation";

import { getLotDetail } from "@/app/inventory/_lib/lot-detail";
import { LotPublicView } from "@/app/inventory/_components/lot-public-view";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function LotPublicViewPage({ params }: Props) {
  const { id } = await params;
  const { lot, slabs, error } = await getLotDetail(id);

  if (error || !lot) {
    notFound();
  }

  return <LotPublicView lot={lot} slabs={slabs} />;
}
