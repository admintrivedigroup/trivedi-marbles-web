import { notFound } from "next/navigation";

import CollectionDetailClient from "@/components/collection/CollectionDetailClient";
import { getMarbleById } from "@/data/marbles";

type CollectionDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CollectionDetailPage({
  params,
}: CollectionDetailPageProps) {
  const { id } = await params;
  const marble = getMarbleById(id);

  if (!marble) {
    notFound();
  }

  return <CollectionDetailClient marble={marble} />;
}
