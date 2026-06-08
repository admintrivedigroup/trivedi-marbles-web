"use client";

import { useState, useTransition, useRef, type ChangeEvent } from "react";
import {
  Edit2,
  Eye,
  EyeOff,
  Globe,
  ImageIcon,
  Link2,
  Loader2,
  Minus,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { compressImage } from "@/lib/cloudinary/compress";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";

import {
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  toggleBlogPostPublished,
  type BlogPostFormData,
} from "@/app/inventory/_actions/blog";
import type { BlogPost } from "@/app/inventory/_lib/blog";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDisplayDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const EMPTY_FORM: BlogPostFormData = {
  title: "",
  category: "",
  date: new Date().toISOString().slice(0, 10),
  excerpt: "",
  cover_image: "",
  content: [""],
  published: false,
};

function postToForm(post: BlogPost): BlogPostFormData {
  return {
    title: post.title,
    category: post.category,
    date: post.date,
    excerpt: post.excerpt,
    cover_image: post.cover_image,
    content: post.content.length > 0 ? post.content : [""],
    published: post.published,
  };
}

// ─── Delete confirm dialog ────────────────────────────────────────────────────

function DeleteConfirm({
  title,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">Delete post?</h3>
        <p className="mt-2 text-sm text-gray-500">
          <span className="font-medium text-gray-700">{title}</span> will be permanently removed.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Post Form Drawer ─────────────────────────────────────────────────────────

function PostFormDrawer({
  post,
  onClose,
}: {
  post: BlogPost | null;
  onClose: () => void;
}) {
  const isEdit = post !== null;
  const [form, setForm] = useState<BlogPostFormData>(
    post ? postToForm(post) : { ...EMPTY_FORM },
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Cover image upload state
  const [imageMode, setImageMode] = useState<"upload" | "url">(
    post?.cover_image ? "url" : "upload",
  );
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof BlogPostFormData>(key: K, value: BlogPostFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setParagraph(index: number, value: string) {
    setForm((prev) => {
      const content = [...prev.content];
      content[index] = value;
      return { ...prev, content };
    });
  }

  function addParagraph() {
    setForm((prev) => ({ ...prev, content: [...prev.content, ""] }));
  }

  function removeParagraph(index: number) {
    setForm((prev) => {
      if (prev.content.length <= 1) return prev;
      const content = prev.content.filter((_, i) => i !== index);
      return { ...prev, content };
    });
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressing(true);
    const compressed = await compressImage(file);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    const preview = URL.createObjectURL(compressed);
    setPendingImageFile(compressed);
    setImagePreviewUrl(preview);
    setIsCompressing(false);
  }

  function clearFileSelection() {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setPendingImageFile(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!form.date) {
      setError("Date is required.");
      return;
    }
    if (imageMode === "upload" && !pendingImageFile && !form.cover_image) {
      setError("Please select a cover image or switch to URL mode.");
      return;
    }
    setError(null);
    startTransition(async () => {
      let coverImage = form.cover_image;

      if (imageMode === "upload" && pendingImageFile) {
        try {
          const { secureUrl } = await uploadToCloudinary(pendingImageFile);
          coverImage = secureUrl;
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Image upload failed. Please try again.",
          );
          return;
        }
      }

      const result = isEdit
        ? await updateBlogPost(post.id, { ...form, cover_image: coverImage })
        : await createBlogPost({ ...form, cover_image: coverImage });

      if (result.success) {
        handleClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40">
      <button
        type="button"
        aria-label="Close form"
        className="absolute inset-0"
        onClick={handleClose}
      />
      <div className="relative z-10 flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? "Edit Post" : "New Post"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form id="post-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Metadata */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Post Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="e.g. The Rise of Fusion Black in Modern Architecture"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => set("category", e.target.value)}
                    placeholder="e.g. Design Trends"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => set("date", e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Excerpt</label>
                <textarea
                  value={form.excerpt}
                  onChange={(e) => set("excerpt", e.target.value)}
                  rows={2}
                  placeholder="A short summary shown on the blog listing page…"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100 resize-none"
                />
              </div>

              {/* Cover image — upload or URL */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Cover Image</label>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setImageMode("upload")}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 transition-colors",
                        imageMode === "upload"
                          ? "bg-gray-900 text-white"
                          : "text-gray-500 hover:bg-gray-50",
                      )}
                    >
                      <Upload className="h-3 w-3" /> Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageMode("url")}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 transition-colors",
                        imageMode === "url"
                          ? "bg-gray-900 text-white"
                          : "text-gray-500 hover:bg-gray-50",
                      )}
                    >
                      <Link2 className="h-3 w-3" /> URL
                    </button>
                  </div>
                </div>

                {imageMode === "upload" ? (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      id="cover-image-upload"
                      onChange={handleFileChange}
                    />
                    {!imagePreviewUrl ? (
                      <label
                        htmlFor="cover-image-upload"
                        className={cn(
                          "flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 transition-colors hover:border-gray-300 hover:bg-gray-100",
                          isCompressing && "cursor-wait opacity-60",
                        )}
                      >
                        {isCompressing ? (
                          <>
                            <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
                            <span className="text-sm text-gray-400">Compressing…</span>
                          </>
                        ) : (
                          <>
                            <ImageIcon className="h-8 w-8 text-gray-300" />
                            <span className="text-sm font-medium text-gray-500">
                              Click to upload cover image
                            </span>
                            <span className="text-xs text-gray-400">
                              JPEG, PNG, WEBP · auto-compressed before upload
                            </span>
                          </>
                        )}
                      </label>
                    ) : (
                      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imagePreviewUrl}
                          alt="Cover preview"
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={clearFileSelection}
                          className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors"
                          title="Remove image"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <label
                          htmlFor="cover-image-upload"
                          className="absolute bottom-2 right-2 cursor-pointer rounded-lg bg-black/60 px-3 py-1.5 text-xs font-medium text-white hover:bg-black/80 transition-colors"
                        >
                          Change
                        </label>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <input
                      type="url"
                      value={form.cover_image}
                      onChange={(e) => set("cover_image", e.target.value)}
                      placeholder="https://…"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100"
                    />
                    {form.cover_image ? (
                      <div className="mt-2 aspect-video w-full overflow-hidden rounded-xl bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={form.cover_image}
                          alt="Cover preview"
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Shared preview note when uploading */}
                {imageMode === "upload" && imagePreviewUrl && (
                  <p className="mt-1.5 text-xs text-gray-400">
                    Image will be uploaded to Cloudinary when you save the post.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Body paragraphs */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Article Body
              </h3>
              <span className="text-xs text-gray-400">
                {form.content.filter(Boolean).length} paragraph{form.content.filter(Boolean).length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-3">
              {form.content.map((paragraph, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs text-gray-400">Paragraph {index + 1}</span>
                    </div>
                    <textarea
                      value={paragraph}
                      onChange={(e) => setParagraph(index, e.target.value)}
                      rows={4}
                      placeholder="Write your paragraph here…"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm leading-relaxed focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100 resize-y"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeParagraph(index)}
                    disabled={form.content.length <= 1}
                    title="Remove paragraph"
                    className="mt-6 h-8 w-8 shrink-0 rounded-lg border border-gray-200 text-gray-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30 transition-colors flex items-center justify-center"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addParagraph}
                className="inline-flex items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors w-full justify-center"
              >
                <Plus className="h-4 w-4" />
                Add Paragraph
              </button>
            </div>
          </section>

          {/* Published toggle */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Visibility
            </h3>
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3">
              <button
                type="button"
                role="switch"
                aria-checked={form.published}
                onClick={() => set("published", !form.published)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  form.published ? "bg-green-500" : "bg-gray-300",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                    form.published ? "translate-x-6" : "translate-x-1",
                  )}
                />
              </button>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {form.published ? (
                    <span className="flex items-center gap-1.5 text-green-700">
                      <Globe className="h-4 w-4" /> Published
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <EyeOff className="h-4 w-4" /> Draft
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-400">
                  {form.published
                    ? "Visible on the public website"
                    : "Only visible to admins"}
                </p>
              </div>
            </div>
          </section>

          {error ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
          ) : null}
        </form>

        {/* Footer */}
        <div className="flex gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="post-form"
            disabled={isPending}
            className="flex-1 rounded-xl bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isEdit ? "Save Changes" : "Create Post"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type JournalManagerProps = {
  initialPosts: BlogPost[];
};

export function JournalManager({ initialPosts }: JournalManagerProps) {
  const [posts, setPosts] = useState<BlogPost[]>(initialPosts);
  const [drawerPost, setDrawerPost] = useState<BlogPost | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [togglePendingId, setTogglePendingId] = useState<string | null>(null);

  function handleDrawerClose() {
    setDrawerPost(null);
  }

  async function handleTogglePublished(post: BlogPost) {
    setTogglePendingId(post.id);
    const newVal = !post.published;
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, published: newVal } : p)),
    );
    const result = await toggleBlogPostPublished(post.id, newVal);
    if (!result.success) {
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, published: !newVal } : p)),
      );
    }
    setTogglePendingId(null);
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    startDelete(async () => {
      const result = await deleteBlogPost(targetId);
      if (result.success) {
        setPosts((prev) => prev.filter((p) => p.id !== targetId));
      }
      setDeleteTarget(null);
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">The Journal</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {posts.length} post{posts.length !== 1 ? "s" : ""} ·{" "}
            {posts.filter((p) => p.published).length} published
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDrawerPost("new")}
          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Post
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Globe className="mb-3 h-10 w-10 text-gray-200" />
            <p className="text-lg font-medium text-gray-400">No posts yet</p>
            <p className="mt-1 text-sm text-gray-400">
              Create your first journal post to get started.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 min-w-[260px]">
                  Title
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Category
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                  Date
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {posts.map((post, idx) => (
                <tr
                  key={post.id}
                  className={cn(
                    "border-b border-gray-100 last:border-0 transition-colors hover:bg-gray-50",
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50/40",
                  )}
                >
                  <td className="px-4 py-3">
                    <p className="max-w-[300px] truncate font-medium text-gray-900">
                      {post.title}
                    </p>
                    {post.excerpt ? (
                      <p className="mt-0.5 max-w-[300px] truncate text-xs text-gray-400">
                        {post.excerpt}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {post.category ? (
                      <span className="whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        {post.category}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {formatDisplayDate(post.date)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={togglePendingId === post.id}
                      onClick={() => handleTogglePublished(post)}
                      title={post.published ? "Click to unpublish" : "Click to publish"}
                      className="disabled:opacity-50"
                    >
                      {togglePendingId === post.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      ) : post.published ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                          <Eye className="h-3 w-3" /> Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                          <EyeOff className="h-3 w-3" /> Draft
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Edit"
                        onClick={() => setDrawerPost(post)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => setDeleteTarget(post)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit drawer */}
      {drawerPost !== null ? (
        <PostFormDrawer
          post={drawerPost === "new" ? null : drawerPost}
          onClose={handleDrawerClose}
        />
      ) : null}

      {/* Delete confirm */}
      {deleteTarget !== null ? (
        <DeleteConfirm
          title={deleteTarget.title}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          loading={isDeleting}
        />
      ) : null}
    </div>
  );
}
