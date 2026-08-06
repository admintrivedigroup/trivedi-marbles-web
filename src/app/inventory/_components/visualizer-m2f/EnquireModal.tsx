"use client";

import { useState } from "react";
import { toast } from "sonner";
import { sendVisualizerEnquiry } from "@/app/inventory/_actions/send-visualizer-enquiry";

type Props = {
  open: boolean;
  onClose: () => void;
  slabCode: string | null;
  marbleName: string | null;
  dimensions: string | null;
  renderShareUrl: string | null;
};

export function EnquireModal({ open, onClose, slabCode, marbleName, dimensions, renderShareUrl }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    const result = await sendVisualizerEnquiry({
      customerName: name,
      customerPhone: phone,
      customerEmail: email,
      notes,
      slabCode,
      marbleName,
      dimensions,
      renderShareUrl,
    });
    setSending(false);

    if (result.success) {
      toast.success("Enquiry sent");
      setName(""); setPhone(""); setEmail(""); setNotes("");
      onClose();
    } else {
      toast.error(result.error ?? "Failed to send enquiry");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl"
      >
        <h2 className="font-serif text-2xl font-medium tracking-tight text-stone-900">
          Enquire About This Slab
        </h2>
        <p className="mt-1 text-xs text-stone-500">
          {[marbleName, slabCode ? `#${slabCode}` : null, dimensions].filter(Boolean).join(" · ") || "No slab selected"}
        </p>

        <div className="mt-5 space-y-3">
          <input
            required
            placeholder="Customer name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#c8a96a]"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#c8a96a]"
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#c8a96a]"
            />
          </div>
          <textarea
            placeholder="Notes (quantity, area, timeline…)"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full resize-none rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#c8a96a]"
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-stone-500 hover:bg-stone-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={sending}
            className="rounded-lg bg-[#c8a96a] px-4 py-2 text-sm font-bold text-[#17130f] transition-colors hover:bg-[#d9bd83] disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send Enquiry"}
          </button>
        </div>
      </form>
    </div>
  );
}
