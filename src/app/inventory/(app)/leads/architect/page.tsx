import { ArchitectLeads } from "@/app/inventory/_components/architect-leads";
import { getArchitectLeads } from "@/app/inventory/_lib/architect-leads";

export const metadata = {
  title: { absolute: "Architect Leads | Trivedi Marbles" },
};

export default async function ArchitectLeadsPage() {
  const leads = await getArchitectLeads();

  return <ArchitectLeads initialLeads={leads} />;
}
