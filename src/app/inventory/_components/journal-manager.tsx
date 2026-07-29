"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Pencil, Archive as ArchiveIcon, Plus, ExternalLink } from "lucide-react";

import type { JournalCategory, JournalPost, JournalStatus } from "@/lib/journal/types";
import { JOURNAL_STATUS_LABELS } from "@/lib/journal/types";
import { formatBlogDate } from "@/lib/blog-shared";
import { archiveJournalPost } from "@/app/inventory/_actions/journal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

type SortKey = "newest-published" | "recently-updated" | "title" | "status";

const STATUS_BADGE_STYLES: Record<JournalStatus, string> = {
  draft: "bg-gray-100 text-gray-500",
  scheduled: "bg-blue-100 text-blue-700",
  published: "bg-green-100 text-green-700",
  archived: "bg-amber-100 text-amber-700",
};

export function JournalManager({
  initialPosts,
  categories,
}: {
  initialPosts: JournalPost[];
  categories: JournalCategory[];
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [authorFilter, setAuthorFilter] = useState<string>("all");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recently-updated");
  const [archiveTarget, setArchiveTarget] = useState<JournalPost | null>(null);

  const authors = useMemo(() => Array.from(new Set(posts.map((p) => p.author_name))).sort(), [posts]);
  const knownCategoryNames = useMemo(() => new Set(categories.map((c) => c.name)), [categories]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = posts.filter((post) => {
      if (statusFilter !== "all" && post.status !== statusFilter) return false;
      if (categoryFilter !== "all" && post.category !== categoryFilter) return false;
      if (authorFilter !== "all" && post.author_name !== authorFilter) return false;
      if (featuredOnly && !post.is_featured) return false;
      if (query) {
        const haystack = `${post.title} ${post.slug ?? ""} ${post.focus_keyword ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (sort) {
        case "newest-published":
          return (b.published_at ?? "").localeCompare(a.published_at ?? "");
        case "title":
          return a.title.localeCompare(b.title);
        case "status":
          return a.status.localeCompare(b.status);
        case "recently-updated":
        default:
          return b.updated_at.localeCompare(a.updated_at);
      }
    });

    return list;
  }, [posts, statusFilter, categoryFilter, authorFilter, featuredOnly, search, sort]);

  async function confirmArchive() {
    if (!archiveTarget) return;
    const result = await archiveJournalPost(archiveTarget.id);
    if (result.success) {
      setPosts((prev) => prev.map((p) => (p.id === archiveTarget.id ? { ...p, status: "archived" } : p)));
    }
    setArchiveTarget(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-gray-900">The Journal</h1>
        <Link
          href="/inventory/journal/new"
          className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700"
        >
          <Plus className="h-4 w-4" /> New Post
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm">
          <option value="all">All statuses</option>
          {Object.entries(JOURNAL_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm">
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={authorFilter} onChange={(e) => setAuthorFilter(e.target.value)} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm">
          <option value="all">All authors</option>
          {authors.map((author) => (
            <option key={author} value={author}>
              {author}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-600">
          <input type="checkbox" checked={featuredOnly} onChange={(e) => setFeaturedOnly(e.target.checked)} /> Featured only
        </label>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm">
          <option value="recently-updated">Recently updated</option>
          <option value="newest-published">Newest published</option>
          <option value="title">Title</option>
          <option value="status">Status</option>
        </select>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, slug, focus keyword…"
          className="min-w-50 flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {["Title", "Category", "Author", "Date", "Status", "Featured", "Slug", "Updated", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((post, idx) => {
              const categoryNeedsReview = Boolean(post.category) && !knownCategoryNames.has(post.category);
              return (
                <tr
                  key={post.id}
                  className={cn(
                    "border-b border-gray-100 transition-colors last:border-0 hover:bg-gray-50",
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50/40",
                  )}
                >
                  <td className="max-w-xs truncate px-4 py-3 font-medium text-gray-900">{post.title}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                      {post.category || "—"}
                    </span>
                    {categoryNeedsReview ? <span className="ml-1 text-xs text-amber-600">needs review</span> : null}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{post.author_name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {post.status === "scheduled" && post.scheduled_at
                      ? new Date(post.scheduled_at).toLocaleString()
                      : post.published_at
                        ? formatBlogDate(post.published_at.slice(0, 10))
                        : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                        STATUS_BADGE_STYLES[post.status],
                      )}
                    >
                      {post.status === "published" ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {JOURNAL_STATUS_LABELS[post.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">{post.is_featured ? "★" : ""}</td>
                  <td className="max-w-35 truncate px-4 py-3 text-xs text-gray-400">{post.slug ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{formatBlogDate(post.updated_at.slice(0, 10))}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {post.slug ? (
                        <a
                          href={`/journal/${post.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Preview"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : null}
                      <Link
                        href={`/inventory/journal/${post.id}/edit`}
                        title="Edit"
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      {post.status !== "archived" ? (
                        <button
                          type="button"
                          title="Archive"
                          onClick={() => setArchiveTarget(post)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <ArchiveIcon className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">
                  No posts match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archive this post?"
        description="It will be hidden from public listings but preserved in the admin — not permanently deleted."
        confirmLabel="Archive"
        onConfirm={confirmArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}
