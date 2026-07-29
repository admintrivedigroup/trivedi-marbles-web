"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import {
  createJournalPost,
  updateJournalPost,
  archiveJournalPost,
  deleteJournalPost,
  type JournalPostFormData,
} from "@/app/inventory/_actions/journal";
import type {
  JournalCategory,
  JournalPost,
  JournalRelatedArticle,
  JournalRelatedProduct,
} from "@/lib/journal/types";
import { validateForPublish } from "@/lib/journal/validation";
import { CharCount, Field, TextArea, TextInput } from "./field-kit";
import { SlugField } from "./slug-field";
import { CategoryCombobox } from "./category-combobox";
import { MultiSelectCombobox } from "./multi-select-combobox";
import { ImageUploadControl } from "./image-upload-control";
import { BlockEditor } from "./block-editor";
import { SeoPanel } from "./seo-panel";
import { InternalLinkingPanel } from "./internal-linking-panel";
import { PublishControls } from "./publish-controls";
import { EXCERPT_RECOMMENDED_MAX, EXCERPT_RECOMMENDED_MIN } from "@/lib/journal/seo-fallbacks";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function buildInitialFormData(post: JournalPost | null): JournalPostFormData {
  return {
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    category: post?.category ?? "",
    author_name: post?.author_name ?? "Trivedi Marbles Editorial Team",
    excerpt: post?.excerpt ?? "",
    cover_image_url: post?.cover_image_url ?? "",
    cover_image_alt: post?.cover_image_alt ?? "",
    content: post?.content ?? [],
    status: post?.status ?? "draft",
    is_featured: post?.is_featured ?? false,
    date: post?.date || todayIso(),
    published_at: post?.published_at ?? null,
    scheduled_at: post?.scheduled_at ?? null,
    focus_keyword: post?.focus_keyword ?? "",
    secondary_keywords: post?.secondary_keywords ?? [],
    seo_title: post?.seo_title ?? "",
    meta_description: post?.meta_description ?? "",
    canonical_url: post?.canonical_url ?? "",
    social_title: post?.social_title ?? "",
    social_description: post?.social_description ?? "",
    social_image_url: post?.social_image_url ?? "",
    robots_index: post?.robots_index ?? true,
    robots_follow: post?.robots_follow ?? true,
    target_audience: post?.target_audience ?? [],
    search_intent: post?.search_intent ?? "",
    related_product_ids: post?.related_product_ids ?? [],
    related_post_ids: post?.related_post_ids ?? [],
  };
}

export function PostEditorForm({
  post,
  categories,
  productOptions,
  articleOptions,
  existingSlugs,
}: {
  post: JournalPost | null;
  categories: JournalCategory[];
  productOptions: JournalRelatedProduct[];
  articleOptions: JournalRelatedArticle[];
  existingSlugs: string[];
}) {
  const router = useRouter();
  const initial = useMemo(() => buildInitialFormData(post), [post]);
  const [formData, setFormData] = useState<JournalPostFormData>(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isDirty = JSON.stringify(formData) !== JSON.stringify(initial);

  useEffect(() => {
    function handler(event: BeforeUnloadEvent) {
      if (!isDirty) return;
      event.preventDefault();
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function patch(update: Partial<JournalPostFormData>) {
    setFormData((prev) => ({ ...prev, ...update }));
  }

  const issues = validateForPublish(
    {
      id: post?.id ?? "",
      title: formData.title,
      slug: formData.slug,
      category: formData.category,
      excerpt: formData.excerpt,
      content: formData.content,
      cover_image_url: formData.cover_image_url,
      cover_image_alt: formData.cover_image_alt || null,
      seo_title: formData.seo_title || null,
      meta_description: formData.meta_description || null,
      canonical_url: formData.canonical_url || null,
      social_image_url: formData.social_image_url || null,
      focus_keyword: formData.focus_keyword || null,
      status: formData.status,
      scheduled_at: formData.scheduled_at,
      published_at: formData.published_at,
      related_post_ids: formData.related_post_ids,
    },
    { existingSlugs },
  );

  async function save(status: JournalPostFormData["status"]) {
    setIsSaving(true);
    setServerError(null);

    const payload: JournalPostFormData = {
      ...formData,
      status,
      published_at: status === "published" ? formData.published_at || new Date().toISOString() : formData.published_at,
    };

    const result = post ? await updateJournalPost(post.id, payload) : await createJournalPost(payload);
    setIsSaving(false);

    if (!result.success) {
      setServerError(result.error);
      return null;
    }
    setFormData(payload);
    return result.id;
  }

  async function handleSaveDraft() {
    const id = await save("draft");
    if (id && !post) router.push(`/inventory/journal/${id}/edit`);
  }

  async function handleSchedule() {
    if (!formData.scheduled_at) {
      setServerError("Choose a scheduled date and time first.");
      return;
    }
    const id = await save("scheduled");
    if (id && !post) router.push(`/inventory/journal/${id}/edit`);
  }

  async function handlePublish() {
    const id = await save("published");
    if (id && !post) router.push(`/inventory/journal/${id}/edit`);
  }

  async function handleArchive() {
    if (!post) return;
    setIsSaving(true);
    await archiveJournalPost(post.id);
    setIsSaving(false);
    router.push("/inventory/journal");
  }

  async function handlePreview() {
    if (!formData.slug) {
      setServerError("Add a title (or slug) before previewing.");
      return;
    }
    const id = await save(formData.status === "published" || formData.status === "scheduled" ? formData.status : "draft");
    if (id) {
      window.open(`/journal/${formData.slug}`, "_blank", "noopener,noreferrer");
    }
  }

  async function handleDelete() {
    if (!post) return;
    setIsSaving(true);
    await deleteJournalPost(post.id);
    setIsSaving(false);
    router.push("/inventory/journal");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => (isDirty ? setConfirmLeave(true) : router.push("/inventory/journal"))}
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          ← Back to Journal
        </button>
        {isDirty ? <span className="text-xs text-amber-600">Unsaved changes</span> : null}
      </div>

      {serverError ? <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{serverError}</div> : null}

      <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5">
        <Field label="Title" required>
          <TextInput value={formData.title} onChange={(e) => patch({ title: e.target.value })} />
        </Field>

        <SlugField
          title={formData.title}
          slug={formData.slug}
          onSlugChange={(slug) => patch({ slug })}
          existingSlugs={existingSlugs}
        />

        <Field label="Category" required>
          <CategoryCombobox categories={categories} value={formData.category} onChange={(category) => patch({ category })} />
        </Field>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Author">
            <TextInput value={formData.author_name} onChange={(e) => patch({ author_name: e.target.value })} />
          </Field>
          <Field label="Publish Date">
            <TextInput type="date" value={formData.date} onChange={(e) => patch({ date: e.target.value })} />
          </Field>
        </div>

        <Field label="Schedule for later" hint="Only used when you click Schedule">
          <TextInput
            type="datetime-local"
            value={formData.scheduled_at ? formData.scheduled_at.slice(0, 16) : ""}
            onChange={(e) => patch({ scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
          />
        </Field>

        <Field label="Excerpt" required>
          <TextArea rows={3} value={formData.excerpt} onChange={(e) => patch({ excerpt: e.target.value })} />
          <CharCount value={formData.excerpt} min={EXCERPT_RECOMMENDED_MIN} max={EXCERPT_RECOMMENDED_MAX} />
        </Field>

        <Field label="Cover Image">
          <ImageUploadControl url={formData.cover_image_url} onChange={(cover_image_url) => patch({ cover_image_url })} />
        </Field>

        <Field label="Cover Image Alt Text" required={Boolean(formData.cover_image_url)}>
          <TextInput value={formData.cover_image_alt} onChange={(e) => patch({ cover_image_alt: e.target.value })} />
        </Field>

        <label className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Featured Article</span>
          <button
            type="button"
            role="switch"
            aria-checked={formData.is_featured}
            onClick={() => patch({ is_featured: !formData.is_featured })}
            className={`h-6 w-11 rounded-full transition-colors ${formData.is_featured ? "bg-green-500" : "bg-gray-300"}`}
          >
            <span
              className={`block h-4 w-4 rounded-full bg-white transition-transform ${formData.is_featured ? "translate-x-6" : "translate-x-1"}`}
            />
          </button>
        </label>

        <Field label="Related Products">
          <MultiSelectCombobox
            options={productOptions.map((p) => ({
              value: p.marbleLotId,
              label: p.marbleName ?? p.marbleLotId,
              sublabel: p.lotNumber,
            }))}
            selected={formData.related_product_ids}
            onChange={(related_product_ids) => patch({ related_product_ids })}
            placeholder="Search products…"
          />
        </Field>

        <Field label="Related Articles">
          <MultiSelectCombobox
            options={articleOptions
              .filter((a) => a.id !== post?.id)
              .map((a) => ({ value: a.id, label: a.title }))}
            selected={formData.related_post_ids}
            onChange={(related_post_ids) => patch({ related_post_ids })}
            placeholder="Search articles…"
          />
        </Field>
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-gray-900">Article Content</p>
        <BlockEditor blocks={formData.content} onChange={(content) => patch({ content })} productOptions={productOptions} />
      </div>

      <SeoPanel
        value={{
          seo_title: formData.seo_title,
          meta_description: formData.meta_description,
          focus_keyword: formData.focus_keyword,
          secondary_keywords: formData.secondary_keywords,
          canonical_url: formData.canonical_url,
          social_title: formData.social_title,
          social_description: formData.social_description,
          social_image_url: formData.social_image_url,
          robots_index: formData.robots_index,
          robots_follow: formData.robots_follow,
        }}
        onChange={(patchValue) => patch(patchValue)}
        fallback={{
          title: formData.title,
          excerpt: formData.excerpt,
          coverImageUrl: formData.cover_image_url,
          slug: formData.slug,
        }}
        status={formData.status}
      />

      <InternalLinkingPanel
        relatedProductIds={formData.related_product_ids}
        relatedPostIds={formData.related_post_ids}
        productOptions={productOptions}
        articleOptions={articleOptions}
        status={formData.status}
      />

      <PublishControls
        isEditing={Boolean(post)}
        currentStatus={formData.status}
        issues={issues}
        isSaving={isSaving}
        onSaveDraft={handleSaveDraft}
        onSchedule={handleSchedule}
        onPublish={handlePublish}
        onArchive={handleArchive}
        onPreview={handlePreview}
      />
      {isSaving ? (
        <p className="flex items-center gap-2 text-xs text-gray-400">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving…
        </p>
      ) : null}

      {post ? (
        <div className="border-t border-gray-100 pt-4 text-right">
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={isSaving}
            className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
          >
            Delete this post permanently
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmLeave}
        title="Discard unsaved changes?"
        description="You have unsaved changes that will be lost."
        confirmLabel="Discard"
        onConfirm={() => {
          setConfirmLeave(false);
          router.push("/inventory/journal");
        }}
        onCancel={() => setConfirmLeave(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this post permanently?"
        description="This is separate from archiving and cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmDelete(false);
          void handleDelete();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
