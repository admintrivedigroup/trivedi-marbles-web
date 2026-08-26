"use client";

import Link from "next/link";
import { Check, Layers } from "lucide-react";

import { withCloudinaryThumbnail } from "@/lib/cloudinary/upload";
import { formatNumber } from "@/app/inventory/_lib/format";
import type { LotFolder } from "@/app/inventory/_lib/lot-folders";

type LotFolderCardProps = {
  lot: LotFolder;
  href: string;
  showCategoryBadge?: boolean;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
};

export function LotFolderCard({
  lot,
  href,
  showCategoryBadge = false,
  selectMode = false,
  selected = false,
  onToggleSelect,
}: LotFolderCardProps) {
  const content = (
    <>
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-t-2xl bg-muted">
        {lot.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={withCloudinaryThumbnail(lot.thumbnailUrl)}
            alt={lot.marbleName ?? "Lot"}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Layers className="h-10 w-10 text-muted-foreground" />
          </div>
        )}

        {selectMode && (
          <span
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border-2 shadow-sm"
            style={{
              background: selected ? "var(--primary)" : "var(--card)",
              borderColor: selected ? "var(--primary)" : "var(--border)",
            }}
          >
            {selected && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
          </span>
        )}

        {lot.availableCount + lot.reservedCount + lot.soldCount > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 w-full overflow-hidden bg-black/10">
            <div className="flex h-full">
              <div style={{ width: `${(lot.availableCount / lot.slabCount) * 100}%` }} className="bg-green-400" />
              <div style={{ width: `${(lot.reservedCount / lot.slabCount) * 100}%` }} className="bg-orange-400" />
              <div style={{ width: `${(lot.soldCount / lot.slabCount) * 100}%` }} className="bg-border" />
            </div>
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-xs font-bold text-foreground">{lot.lotNumber ?? "-"}</span>
          {showCategoryBadge && lot.categoryName && (
            <span className="truncate rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {lot.categoryName}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate font-medium text-foreground">{lot.marbleName ?? "Untitled Lot"}</p>
        <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {lot.slabCount} {lot.slabCount === 1 ? "slab" : "slabs"}
          </span>
          <span>{formatNumber(lot.totalSqft)} sqft</span>
        </div>
      </div>
    </>
  );

  const className =
    "group block overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md " +
    (selectMode && selected ? "border-primary ring-2 ring-primary/20" : "border-border");

  if (selectMode) {
    return (
      <button type="button" onClick={onToggleSelect} className={`${className} text-left`}>
        {content}
      </button>
    );
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}
