import { InventoryScreenPlaceholder } from "@/app/inventory/_components/inventory-screen-placeholder";

type EditStockPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditStockPage({ params }: EditStockPageProps) {
  const { id } = await params;

  return (
    <InventoryScreenPlaceholder
      eyebrow="Edit Stock"
      title="Dynamic edit routing is ready for the shared AddStock screen."
      description="The exported router uses AddStock.tsx for both create and edit flows. This Next route mirrors that behavior with a dynamic [id] segment."
      panels={[
        {
          label: "Source Component",
          value: "AddStock.tsx",
          description: "This page should reuse the same Figma screen as the create route, but hydrated with an existing slab record.",
        },
        {
          label: "Slab ID",
          value: id,
          description: "The dynamic route parameter is available and ready to drive future data loading.",
        },
        {
          label: "Route",
          value: "/inventory/edit/[id]",
          description: "This mirrors the React Router child path 'edit/:id'.",
        },
      ]}
    />
  );
}
