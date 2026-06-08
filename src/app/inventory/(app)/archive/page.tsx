import { InventoryArchive } from "@/app/inventory/_components/inventory-archive";
import { getArchivedItems } from "@/app/inventory/_lib/archive";

export default async function ArchivePage() {
  const { error, slabs, lots } = await getArchivedItems();
  return <InventoryArchive error={error} slabs={slabs} lots={lots} />;
}
