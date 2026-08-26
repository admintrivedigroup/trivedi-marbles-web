"use client";

import Link from "next/link";
import { Folder } from "lucide-react";

import { withCloudinaryThumbnail } from "@/lib/cloudinary/upload";
import type { CategoryFolder } from "@/app/inventory/_lib/category-overview";

export function CategoryCard({ category }: { category: CategoryFolder }) {
  return (
    <Link
      href={`/inventory/list/${category.id}`}
      className="group block overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-md"
    >
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-t-2xl bg-muted">
        {category.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={withCloudinaryThumbnail(category.thumbnailUrl)}
            alt={category.name}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Folder className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-black/0" />
        <p className="absolute inset-x-0 bottom-0 truncate px-3 py-2 font-semibold text-white">
          {category.name}
        </p>
      </div>

      <div className="flex items-center justify-between px-3 py-2.5 text-xs text-muted-foreground">
        <span>
          {category.lotCount} {category.lotCount === 1 ? "lot" : "lots"}
        </span>
        <span>{category.availableCount} available</span>
      </div>
    </Link>
  );
}
