"use client";

import type { JournalRelatedArticle, JournalRelatedProduct, JournalStatus } from "@/lib/journal/types";

/** Informational only — never auto-inserts links into the article body. */
export function InternalLinkingPanel({
  relatedProductIds,
  relatedPostIds,
  productOptions,
  articleOptions,
  status,
}: {
  relatedProductIds: string[];
  relatedPostIds: string[];
  productOptions: JournalRelatedProduct[];
  articleOptions: JournalRelatedArticle[];
  status: JournalStatus;
}) {
  const missingProducts = relatedProductIds.filter(
    (id) => !productOptions.some((p) => p.marbleLotId === id),
  ).length;
  const missingArticles = relatedPostIds.filter((id) => !articleOptions.some((a) => a.id === id)).length;
  const totalLinks = relatedProductIds.length + relatedPostIds.length;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="mb-3 text-sm font-semibold text-gray-900">Internal Linking</p>
      <div className="space-y-1.5 text-sm text-gray-600">
        <p>
          {relatedProductIds.length} related product{relatedProductIds.length === 1 ? "" : "s"},{" "}
          {relatedPostIds.length} related article{relatedPostIds.length === 1 ? "" : "s"}.
        </p>
        {status === "published" && totalLinks === 0 ? (
          <p className="text-amber-600">This published article has no internal links.</p>
        ) : null}
        {missingProducts > 0 ? (
          <p className="text-red-600">
            {missingProducts} linked product{missingProducts === 1 ? "" : "s"} no longer exist{missingProducts === 1 ? "s" : ""}.
          </p>
        ) : null}
        {missingArticles > 0 ? (
          <p className="text-red-600">
            {missingArticles} linked article{missingArticles === 1 ? "" : "s"} no longer exist{missingArticles === 1 ? "s" : ""}.
          </p>
        ) : null}
      </div>
    </div>
  );
}
