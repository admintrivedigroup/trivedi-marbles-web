import { notFound } from "next/navigation";

import { EditLot } from "@/app/inventory/_components/edit-lot";
import { getLotForEdit } from "@/app/inventory/_lib/lot-edit";

type LotEditPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LotEditPage({ params }: LotEditPageProps) {
  const { id } = await params;
  const { error, lot } = await getLotForEdit(id);

  if (error && !lot) {
    return (
      <div className="px-4 py-8 md:px-8">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!lot) notFound();

  return (
    <div className="p-4 md:p-8">
      <EditLot lot={lot} />
    </div>
  );
}
