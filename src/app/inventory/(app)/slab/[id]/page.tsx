import { InventoryScreenPlaceholder } from "@/app/inventory/_components/inventory-screen-placeholder";

type SlabDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SlabDetailPage({
  params,
}: SlabDetailPageProps) {
  const { id } = await params;

  return (
    <InventoryScreenPlaceholder
      eyebrow="Slab Detail"
      title="The slab detail route is ready for the dedicated Figma detail screen."
      description="This page maps the exported SlabDetail.tsx route onto a dynamic Next segment so individual slab records can get their own detail view."
      panels={[
        {
          label: "Source Component",
          value: "SlabDetail.tsx",
          description: "This will become the slab overview screen with photos, metrics, and actions once you send that component.",
        },
        {
          label: "Slab ID",
          value: id,
          description: "The dynamic route parameter is already available for future fetching and rendering.",
        },
        {
          label: "Route",
          value: "/inventory/slab/[id]",
          description: "This mirrors the React Router child path 'slab/:id'.",
        },
      ]}
    />
  );
}
