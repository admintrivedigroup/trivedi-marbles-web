import { PencilRuler } from "lucide-react";

export const metadata = {
  title: { absolute: "Architect Leads | Trivedi Marbles" },
};

export default function ArchitectLeadsPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="rounded-full bg-muted p-4">
        <PencilRuler className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-semibold text-foreground">Architect Leads</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This section is coming soon.
      </p>
    </div>
  );
}
