import { notFound } from "next/navigation";
import { headers } from "next/headers";

import { getSlabById } from "@/app/inventory/_lib/slab-detail";
import { SlabLabel } from "@/app/inventory/_components/slab-label";

type LabelPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SlabLabelPage({ params }: LabelPageProps) {
  const { id } = await params;
  const { slab, error } = await getSlabById(id);

  if (error || !slab) {
    notFound();
  }

  const headersList = await headers();
  const forwardedHost = headersList.get("x-forwarded-host");
  const host = forwardedHost ?? headersList.get("host") ?? "localhost:3000";
  const proto =
    headersList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const slabUrl = `${proto}://${host}/inventory/slab/${id}/view`;

  return <SlabLabel slab={slab} slabUrl={slabUrl} />;
}
