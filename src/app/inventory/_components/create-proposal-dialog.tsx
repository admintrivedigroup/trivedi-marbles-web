"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/app/inventory/_components/ui/dialog";
import { createProposal } from "@/app/inventory/_actions/create-proposal";
import {
  getProposalLotDetails,
  type ProposalSlabDetail,
} from "@/app/inventory/_actions/get-proposal-lot-details";
import { formatSize } from "@/app/inventory/_lib/format";

type QuantityNote = "" | "Plus" | "Same";

type ProposalItemState = {
  lotId: string;
  lotNumber: string | null;
  marbleName: string | null;
  availableSqft: number;
  slabs: ProposalSlabDetail[];
  quantityNote: QuantityNote;
  finish: string;
  origin: string;
};

type CreateProposalDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lotIds: string[];
};

const DEFAULT_FINISH = "Polished";

export function CreateProposalDialog({ open, onOpenChange, lotIds }: CreateProposalDialogProps) {
  const [clientName, setClientName] = useState("");
  const [items, setItems] = useState<ProposalItemState[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch fresh slab-level detail (photos + measurements) each time the
  // dialog opens with a new lot selection, rather than trusting cached props.
  useEffect(() => {
    if (!open) return;
    setClientName("");
    setErrorMessage(null);
    setItems([]);
    setIsLoading(true);

    getProposalLotDetails(lotIds).then((result) => {
      setIsLoading(false);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      if (result.lots.length === 0) {
        setErrorMessage("The selected lot(s) have no available slabs.");
        return;
      }
      setItems(
        result.lots.map((lot) => ({
          lotId: lot.lotId,
          lotNumber: lot.lotNumber,
          marbleName: lot.marbleName,
          availableSqft: lot.availableSqft,
          slabs: lot.slabs,
          quantityNote: "",
          finish: DEFAULT_FINISH,
          origin: "",
        })),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updateItem = <K extends keyof ProposalItemState>(
    lotId: string,
    field: K,
    value: ProposalItemState[K],
  ) => {
    setItems((prev) => prev.map((i) => (i.lotId === lotId ? { ...i, [field]: value } : i)));
  };

  const totalSlabs = items.reduce((sum, i) => sum + i.slabs.length, 0);

  const handleGenerate = async () => {
    setErrorMessage(null);

    if (!clientName.trim()) {
      setErrorMessage("Enter a client name to generate the proposal.");
      return;
    }
    if (items.length === 0) {
      setErrorMessage("Select at least one lot for the proposal.");
      return;
    }

    setIsGenerating(true);
    try {
      const pdfItems = items.map((i) => ({
        marbleName: i.marbleName ?? "Unknown",
        lotNumber: i.lotNumber ?? "-",
        sqft: Math.round(i.availableSqft),
        quantityNote: i.quantityNote,
        finish: i.finish,
        origin: i.origin,
        slabs: i.slabs.map((sl) => ({
          slabCode: sl.slabCode ?? "-",
          length: sl.length,
          width: sl.width,
          sqft: sl.sqft,
          photoUrl: sl.photoUrl,
        })),
      }));

      const result = await createProposal({ clientName, items: pdfItems });

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      const [{ pdf }, { ProposalDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./proposal-pdf"),
      ]);

      const date = new Date(result.date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      const logoUrl = `${window.location.origin}/images/vijay-trivedi-logo-email.png`;

      const blob = await pdf(
        <ProposalDocument
          referenceNo={result.referenceNo}
          date={date}
          clientName={clientName.trim()}
          items={pdfItems}
          logoUrl={logoUrl}
        />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${result.referenceNo.replace(/\//g, "-")}-${clientName.trim().replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      onOpenChange(false);
    } catch {
      setErrorMessage("Failed to generate the proposal. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isGenerating && onOpenChange(next)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Proposal</DialogTitle>
          <DialogDescription>
            {isLoading
              ? "Loading available slabs…"
              : `${items.length} lot${items.length !== 1 ? "s" : ""} · ${totalSlabs} slab${totalSlabs !== 1 ? "s" : ""} · fixed title and description`}
          </DialogDescription>
        </DialogHeader>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Client Name</label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
            placeholder="Mr. Aadesh Patel"
            autoFocus
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading lots…
          </div>
        ) : (
          <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
            {items.map((item) => (
              <div key={item.lotId} className="rounded-xl border border-gray-200 p-3">
                <div className="mb-2">
                  <p className="text-sm font-semibold text-gray-900">
                    {item.marbleName ?? "Unknown Marble"}
                  </p>
                  <p className="text-xs text-gray-500">
                    Lot {item.lotNumber ?? "-"} · {item.slabs.length} slab
                    {item.slabs.length !== 1 ? "s" : ""} · {Math.round(item.availableSqft)} sqft available
                  </p>
                </div>

                <div className="mb-3 grid grid-cols-3 gap-1.5">
                  <div>
                    <label className="mb-0.5 block text-[10px] font-medium text-gray-500">Finish</label>
                    <input
                      type="text"
                      value={item.finish}
                      onChange={(e) => updateItem(item.lotId, "finish", e.target.value)}
                      className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs focus:border-transparent focus:outline-none focus:ring-1 focus:ring-gray-800"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] font-medium text-gray-500">Origin</label>
                    <input
                      type="text"
                      value={item.origin}
                      onChange={(e) => updateItem(item.lotId, "origin", e.target.value)}
                      placeholder="e.g. Ambaji, Ind"
                      className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs focus:border-transparent focus:outline-none focus:ring-1 focus:ring-gray-800"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] font-medium text-gray-500">Quantity</label>
                    <select
                      value={item.quantityNote}
                      onChange={(e) => updateItem(item.lotId, "quantityNote", e.target.value as QuantityNote)}
                      className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs focus:border-transparent focus:outline-none focus:ring-1 focus:ring-gray-800"
                    >
                      <option value="">None</option>
                      <option value="Plus">Plus</option>
                      <option value="Same">Same</option>
                    </select>
                  </div>
                </div>

                <ul className="grid grid-cols-3 gap-1.5">
                  {item.slabs.map((slab) => (
                    <li
                      key={slab.slabId}
                      className="overflow-hidden rounded-lg border border-gray-100 bg-gray-50"
                    >
                      <div className="aspect-4/3 w-full bg-gray-100">
                        {slab.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={slab.photoUrl} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="px-1.5 py-1">
                        <p className="truncate font-mono text-[10px] font-medium text-gray-700">
                          {slab.slabCode ?? "-"}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {formatSize(slab.length, slab.width) ?? "Size N/A"} · {slab.sqft} sqft
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {errorMessage && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{errorMessage}</p>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || isLoading || items.length === 0}
            className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Generate &amp; Download
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
