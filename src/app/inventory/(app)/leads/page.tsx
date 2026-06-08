import { ClientLeads } from "@/app/inventory/_components/client-leads";
import { getClientLeads } from "@/app/inventory/_lib/client-leads";

export const metadata = {
  title: "Client Leads | Trivedi Marbles",
};

export default async function ClientLeadsPage() {
  const leads = await getClientLeads();

  return <ClientLeads initialLeads={leads} />;
}
