import { notFound } from "next/navigation";

import { LotDetail } from "@/app/inventory/_components/lot-detail";
import { getLotDetail } from "@/app/inventory/_lib/lot-detail";

type LotDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LotDetailPage({ params }: LotDetailPageProps) {
  const { id } = await params;
  const { error, lot, slabs } = await getLotDetail(id);

  if (error && !lot) {
    return (
      <div className="px-4 py-8 md:px-8">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!lot) {
    notFound();
  }

  return (
    <div className="p-4 md:p-8">
      <LotDetail lot={lot} slabs={slabs} />
    </div>
  );
}
