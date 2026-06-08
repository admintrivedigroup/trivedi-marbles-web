import { notFound } from "next/navigation";

import { EditSlab } from "@/app/inventory/_components/edit-slab";
import { getSlabForEdit } from "@/app/inventory/_lib/slab-edit";
import { getInTransitSlabIds } from "@/app/inventory/_lib/transfers";

type EditSlabPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditSlabPage({ params }: EditSlabPageProps) {
  const { id } = await params;
  const [{ error, slab }, inTransitSlabIds] = await Promise.all([
    getSlabForEdit(id),
    getInTransitSlabIds(),
  ]);

  if (inTransitSlabIds.has(id)) {
    return (
      <div className="px-4 py-8 md:px-8">
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-700">
          <p className="font-semibold">Slab is In Transit</p>
          <p className="mt-1">This slab cannot be edited while it is being transferred to another warehouse. Please wait until the transfer is received or cancelled.</p>
        </div>
      </div>
    );
  }

  if (error && !slab) {
    return (
      <div className="px-4 py-8 md:px-8">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!slab) notFound();

  return (
    <div className="p-4 md:p-8">
      <EditSlab slab={slab} />
    </div>
  );
}
