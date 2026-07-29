"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, Copy, GripVertical, Plus, Trash2 } from "lucide-react";

import type { ContentBlock, ContentBlockType, JournalRelatedProduct } from "@/lib/journal/types";
import { CONTENT_BLOCK_LABELS } from "@/lib/journal/types";
import { createBlock, generateBlockId } from "@/lib/journal/blocks";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { IconButton } from "./field-kit";
import {
  ParagraphBlockEditor,
  HeadingBlockEditor,
  ImageBlockEditor,
  ListBlockEditor,
  QuoteBlockEditor,
  ComparisonTableBlockEditor,
  KeyTakeawayBlockEditor,
  ProductCardBlockEditor,
  ProjectCardBlockEditor,
  InquiryCtaBlockEditor,
  FaqSectionBlockEditor,
  VideoEmbedBlockEditor,
} from "./block-editors";

const ADD_MENU_ITEMS: { type: ContentBlockType; label: string; level?: 2 | 3 }[] = [
  { type: "paragraph", label: "Paragraph" },
  { type: "heading", label: "H2 Heading", level: 2 },
  { type: "heading", label: "H3 Heading", level: 3 },
  { type: "image", label: "Image" },
  { type: "bulleted-list", label: "Bulleted List" },
  { type: "numbered-list", label: "Numbered List" },
  { type: "quote", label: "Quote" },
  { type: "comparison-table", label: "Comparison Table" },
  { type: "key-takeaway", label: "Key Takeaway" },
  { type: "product-card", label: "Product Card" },
  { type: "project-card", label: "Project Card" },
  { type: "inquiry-cta", label: "Inquiry CTA" },
  { type: "faq-section", label: "FAQ Section" },
  { type: "video-embed", label: "Video Embed" },
];

function BlockBody({
  block,
  onChange,
  productOptions,
}: {
  block: ContentBlock;
  onChange: (block: ContentBlock) => void;
  productOptions: JournalRelatedProduct[];
}) {
  switch (block.type) {
    case "paragraph":
      return <ParagraphBlockEditor data={block.data} onChange={(data) => onChange({ ...block, data })} />;
    case "heading":
      return <HeadingBlockEditor data={block.data} onChange={(data) => onChange({ ...block, data })} />;
    case "image":
      return <ImageBlockEditor data={block.data} onChange={(data) => onChange({ ...block, data })} />;
    case "bulleted-list":
    case "numbered-list":
      return <ListBlockEditor data={block.data} onChange={(data) => onChange({ ...block, data })} />;
    case "quote":
      return <QuoteBlockEditor data={block.data} onChange={(data) => onChange({ ...block, data })} />;
    case "comparison-table":
      return <ComparisonTableBlockEditor data={block.data} onChange={(data) => onChange({ ...block, data })} />;
    case "key-takeaway":
      return <KeyTakeawayBlockEditor data={block.data} onChange={(data) => onChange({ ...block, data })} />;
    case "product-card":
      return (
        <ProductCardBlockEditor
          data={block.data}
          onChange={(data) => onChange({ ...block, data })}
          productOptions={productOptions}
        />
      );
    case "project-card":
      return <ProjectCardBlockEditor data={block.data} onChange={(data) => onChange({ ...block, data })} />;
    case "inquiry-cta":
      return <InquiryCtaBlockEditor data={block.data} onChange={(data) => onChange({ ...block, data })} />;
    case "faq-section":
      return <FaqSectionBlockEditor data={block.data} onChange={(data) => onChange({ ...block, data })} />;
    case "video-embed":
      return <VideoEmbedBlockEditor data={block.data} onChange={(data) => onChange({ ...block, data })} />;
    default:
      return null;
  }
}

function SortableBlock({
  block,
  index,
  total,
  productOptions,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
}: {
  block: ContentBlock;
  index: number;
  total: number;
  productOptions: JournalRelatedProduct[];
  onChange: (block: ContentBlock) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const style = { transform: CSS.Transform.toString(transform), transition };
  const headingSuffix = block.type === "heading" ? ` (H${block.data.level})` : "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("rounded-2xl border border-gray-200 bg-white p-4", isDragging && "opacity-50 shadow-lg")}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none rounded p-1 text-gray-300 hover:text-gray-500 active:cursor-grabbing"
            aria-label="Drag to reorder block"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {CONTENT_BLOCK_LABELS[block.type]}
            {headingSuffix}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <IconButton title="Move up" onClick={() => onMove(index, -1)} disabled={index === 0}>
            <ChevronUp className="h-4 w-4" />
          </IconButton>
          <IconButton title="Move down" onClick={() => onMove(index, 1)} disabled={index === total - 1}>
            <ChevronDown className="h-4 w-4" />
          </IconButton>
          <IconButton title="Duplicate block" onClick={onDuplicate}>
            <Copy className="h-4 w-4" />
          </IconButton>
          <IconButton title="Delete block" variant="danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <BlockBody block={block} onChange={onChange} productOptions={productOptions} />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this block?"
        description="This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

export function BlockEditor({
  blocks,
  onChange,
  productOptions,
}: {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  productOptions: JournalRelatedProduct[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function updateBlockAt(index: number, next: ContentBlock) {
    const copy = [...blocks];
    copy[index] = next;
    onChange(copy);
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const copy = [...blocks];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    onChange(copy);
  }

  function duplicateBlock(index: number) {
    const copy = [...blocks];
    copy.splice(index + 1, 0, { ...blocks[index], id: generateBlockId() });
    onChange(copy);
  }

  function deleteBlock(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }

  function addBlock(type: ContentBlockType, level?: 2 | 3) {
    onChange([...blocks, createBlock(type, level)]);
    setMenuOpen(false);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(blocks, oldIndex, newIndex));
  }

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {blocks.map((block, index) => (
            <SortableBlock
              key={block.id}
              block={block}
              index={index}
              total={blocks.length}
              productOptions={productOptions}
              onChange={(next) => updateBlockAt(index, next)}
              onMove={moveBlock}
              onDuplicate={() => duplicateBlock(index)}
              onDelete={() => deleteBlock(index)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {blocks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-400">
          No content yet. Add your first block below.
        </p>
      ) : null}

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Plus className="h-4 w-4" /> Add Block
        </button>
        {menuOpen ? (
          <div className="absolute z-10 mt-2 grid w-64 grid-cols-1 gap-0.5 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
            {ADD_MENU_ITEMS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => addBlock(item.type, item.level)}
                className="rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
