"use client";

import { Plus, Trash2 } from "lucide-react";

import type {
  ComparisonTableBlockData,
  FaqSectionBlockData,
  HeadingBlockData,
  ImageBlockData,
  InquiryCtaBlockData,
  KeyTakeawayBlockData,
  ListBlockData,
  ParagraphBlockData,
  ProductCardBlockData,
  ProjectCardBlockData,
  QuoteBlockData,
  VideoEmbedBlockData,
} from "@/lib/journal/types";
import type { JournalRelatedProduct } from "@/lib/journal/types";
import { Field, IconButton, TextArea, TextInput, inputClass } from "./field-kit";
import { ImageUploadControl } from "./image-upload-control";

type Editor<T> = { data: T; onChange: (data: T) => void };

export function ParagraphBlockEditor({ data, onChange }: Editor<ParagraphBlockData>) {
  return (
    <TextArea
      rows={4}
      value={data.text}
      onChange={(e) => onChange({ text: e.target.value })}
      placeholder="Paragraph text. Supports **bold**, *italic*, and [link](url)."
    />
  );
}

export function HeadingBlockEditor({ data, onChange }: Editor<HeadingBlockData>) {
  return (
    <div className="flex items-center gap-3">
      <select
        value={data.level}
        onChange={(e) => onChange({ ...data, level: Number(e.target.value) as 2 | 3 })}
        className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
      >
        <option value={2}>H2</option>
        <option value={3}>H3</option>
      </select>
      <TextInput
        value={data.text}
        onChange={(e) => onChange({ ...data, text: e.target.value })}
        placeholder="Heading text"
        className="flex-1"
      />
    </div>
  );
}

export function ImageBlockEditor({ data, onChange }: Editor<ImageBlockData>) {
  return (
    <div className="space-y-3">
      <ImageUploadControl url={data.url} onChange={(url) => onChange({ ...data, url })} />
      <Field label="Alt text" required>
        <TextInput value={data.alt} onChange={(e) => onChange({ ...data, alt: e.target.value })} />
      </Field>
      <Field label="Caption">
        <TextInput value={data.caption ?? ""} onChange={(e) => onChange({ ...data, caption: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Width (px)">
          <TextInput
            type="number"
            value={data.width ?? ""}
            onChange={(e) => onChange({ ...data, width: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>
        <Field label="Height (px)">
          <TextInput
            type="number"
            value={data.height ?? ""}
            onChange={(e) => onChange({ ...data, height: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>
      </div>
    </div>
  );
}

export function ListBlockEditor({ data, onChange }: Editor<ListBlockData>) {
  return (
    <div className="space-y-2">
      {data.items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <TextInput
            value={item}
            onChange={(e) => {
              const items = [...data.items];
              items[index] = e.target.value;
              onChange({ items });
            }}
          />
          <IconButton
            title="Remove item"
            variant="danger"
            onClick={() => onChange({ items: data.items.filter((_, i) => i !== index) })}
            disabled={data.items.length <= 1}
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange({ items: [...data.items, ""] })}
        className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800"
      >
        <Plus className="h-3 w-3" /> Add item
      </button>
    </div>
  );
}

export function QuoteBlockEditor({ data, onChange }: Editor<QuoteBlockData>) {
  return (
    <div className="space-y-3">
      <TextArea rows={3} value={data.text} onChange={(e) => onChange({ ...data, text: e.target.value })} placeholder="Quote text" />
      <TextInput
        value={data.attribution ?? ""}
        onChange={(e) => onChange({ ...data, attribution: e.target.value })}
        placeholder="Attribution (optional)"
      />
    </div>
  );
}

export function ComparisonTableBlockEditor({ data, onChange }: Editor<ComparisonTableBlockData>) {
  function updateColumn(index: number, value: string) {
    const columns = [...data.columns];
    columns[index] = value;
    onChange({ ...data, columns });
  }
  function updateCell(rowIndex: number, colIndex: number, value: string) {
    const rows = data.rows.map((row) => [...row]);
    rows[rowIndex][colIndex] = value;
    onChange({ ...data, rows });
  }

  return (
    <div className="space-y-3">
      <TextInput
        value={data.caption ?? ""}
        onChange={(e) => onChange({ ...data, caption: e.target.value })}
        placeholder="Table caption (optional)"
      />
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {data.columns.map((col, i) => (
                <th key={i} className="p-2">
                  <TextInput value={col} onChange={(e) => updateColumn(i, e.target.value)} placeholder={`Column ${i + 1}`} />
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-gray-100">
                {row.map((cell, colIndex) => (
                  <td key={colIndex} className="p-2">
                    <TextInput value={cell} onChange={(e) => updateCell(rowIndex, colIndex, e.target.value)} />
                  </td>
                ))}
                <td className="p-2">
                  <IconButton
                    title="Remove row"
                    variant="danger"
                    onClick={() => onChange({ ...data, rows: data.rows.filter((_, i) => i !== rowIndex) })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => onChange({ ...data, columns: [...data.columns, ""], rows: data.rows.map((row) => [...row, ""]) })}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800"
        >
          <Plus className="h-3 w-3" /> Add column
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...data, rows: [...data.rows, data.columns.map(() => "")] })}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800"
        >
          <Plus className="h-3 w-3" /> Add row
        </button>
      </div>
    </div>
  );
}

export function KeyTakeawayBlockEditor({ data, onChange }: Editor<KeyTakeawayBlockData>) {
  return (
    <div className="space-y-3">
      <TextInput
        value={data.title ?? ""}
        onChange={(e) => onChange({ ...data, title: e.target.value })}
        placeholder="Title (optional, e.g. Key Takeaway)"
      />
      <TextArea rows={3} value={data.text} onChange={(e) => onChange({ ...data, text: e.target.value })} />
    </div>
  );
}

export function ProductCardBlockEditor({
  data,
  onChange,
  productOptions,
}: Editor<ProductCardBlockData> & { productOptions: JournalRelatedProduct[] }) {
  return (
    <div className="space-y-3">
      <select
        value={data.marbleLotId}
        onChange={(e) => onChange({ ...data, marbleLotId: e.target.value })}
        className={inputClass}
      >
        <option value="">Select a product…</option>
        {productOptions.map((product) => (
          <option key={product.marbleLotId} value={product.marbleLotId}>
            {product.marbleName} {product.lotNumber ? `(${product.lotNumber})` : ""}
          </option>
        ))}
      </select>
      <TextInput
        value={data.note ?? ""}
        onChange={(e) => onChange({ ...data, note: e.target.value })}
        placeholder="Optional note shown on the card"
      />
    </div>
  );
}

export function ProjectCardBlockEditor({ data, onChange }: Editor<ProjectCardBlockData>) {
  return (
    <div className="space-y-3">
      <TextInput value={data.title} onChange={(e) => onChange({ ...data, title: e.target.value })} placeholder="Project title" />
      <ImageUploadControl url={data.imageUrl ?? ""} onChange={(imageUrl) => onChange({ ...data, imageUrl })} />
      <TextArea
        rows={2}
        value={data.description ?? ""}
        onChange={(e) => onChange({ ...data, description: e.target.value })}
        placeholder="Description (optional)"
      />
      <TextInput
        value={data.url ?? ""}
        onChange={(e) => onChange({ ...data, url: e.target.value })}
        placeholder="Link (optional, /projects/... )"
      />
    </div>
  );
}

export function InquiryCtaBlockEditor({ data, onChange }: Editor<InquiryCtaBlockData>) {
  return (
    <div className="space-y-3">
      <TextInput value={data.heading} onChange={(e) => onChange({ ...data, heading: e.target.value })} placeholder="Heading" />
      <TextArea
        rows={2}
        value={data.body ?? ""}
        onChange={(e) => onChange({ ...data, body: e.target.value })}
        placeholder="Supporting text (optional)"
      />
      <TextInput
        value={data.buttonLabel}
        onChange={(e) => onChange({ ...data, buttonLabel: e.target.value })}
        placeholder="Button label"
      />
      <div className="flex gap-3">
        <select
          value={data.destinationType}
          onChange={(e) => onChange({ ...data, destinationType: e.target.value as "internal" | "whatsapp" })}
          className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
        >
          <option value="whatsapp">WhatsApp</option>
          <option value="internal">Internal link</option>
        </select>
        <TextInput
          value={data.destinationValue}
          onChange={(e) => onChange({ ...data, destinationValue: e.target.value })}
          placeholder={data.destinationType === "whatsapp" ? "https://wa.me/91..." : "/contact"}
          className="flex-1"
        />
      </div>
    </div>
  );
}

export function FaqSectionBlockEditor({ data, onChange }: Editor<FaqSectionBlockData>) {
  function updateFaq(index: number, patch: Partial<{ question: string; answer: string }>) {
    const faqs = data.faqs.map((faq, i) => (i === index ? { ...faq, ...patch } : faq));
    onChange({ faqs });
  }
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= data.faqs.length) return;
    const faqs = [...data.faqs];
    [faqs[index], faqs[target]] = [faqs[target], faqs[index]];
    onChange({ faqs });
  }

  return (
    <div className="space-y-3">
      {data.faqs.map((faq, index) => (
        <div key={faq.id} className="space-y-2 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">FAQ {index + 1}</span>
            <div className="flex items-center gap-1">
              <IconButton title="Move up" onClick={() => move(index, -1)} disabled={index === 0}>
                ↑
              </IconButton>
              <IconButton title="Move down" onClick={() => move(index, 1)} disabled={index === data.faqs.length - 1}>
                ↓
              </IconButton>
              <IconButton
                title="Delete FAQ"
                variant="danger"
                onClick={() => onChange({ faqs: data.faqs.filter((_, i) => i !== index) })}
              >
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
          <TextInput
            value={faq.question}
            onChange={(e) => updateFaq(index, { question: e.target.value })}
            placeholder="Question"
          />
          <TextArea rows={2} value={faq.answer} onChange={(e) => updateFaq(index, { answer: e.target.value })} placeholder="Answer" />
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange({
            faqs: [...data.faqs, { id: crypto.randomUUID(), question: "", answer: "" }],
          })
        }
        className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800"
      >
        <Plus className="h-3 w-3" /> Add FAQ
      </button>
    </div>
  );
}

export function VideoEmbedBlockEditor({ data, onChange }: Editor<VideoEmbedBlockData>) {
  return (
    <div className="space-y-3">
      <select
        value={data.provider}
        onChange={(e) => onChange({ ...data, provider: e.target.value as "youtube" | "vimeo" })}
        className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
      >
        <option value="youtube">YouTube</option>
        <option value="vimeo">Vimeo</option>
      </select>
      <TextInput
        value={data.url}
        onChange={(e) => onChange({ ...data, url: e.target.value })}
        placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..."
      />
      <TextInput
        value={data.caption ?? ""}
        onChange={(e) => onChange({ ...data, caption: e.target.value })}
        placeholder="Caption (optional)"
      />
    </div>
  );
}
