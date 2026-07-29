"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import type { JournalStatus } from "@/lib/journal/types";
import {
  MAX_SECONDARY_KEYWORDS,
  META_DESCRIPTION_RECOMMENDED_MAX,
  META_DESCRIPTION_RECOMMENDED_MIN,
  SEO_TITLE_RECOMMENDED_MAX,
  SEO_TITLE_RECOMMENDED_MIN,
  journalArticleUrl,
  BASE_URL,
} from "@/lib/journal/seo-fallbacks";
import { CharCount, Field, TextArea, TextInput } from "./field-kit";

export type RobotsChoice = "index-follow" | "noindex-follow" | "noindex-nofollow";

export type SeoFormState = {
  seo_title: string;
  meta_description: string;
  focus_keyword: string;
  secondary_keywords: string[];
  canonical_url: string;
  social_title: string;
  social_description: string;
  social_image_url: string;
  robots_index: boolean;
  robots_follow: boolean;
};

const ROBOTS_LABELS: Record<RobotsChoice, string> = {
  "index-follow": "Index & Follow",
  "noindex-follow": "Noindex & Follow",
  "noindex-nofollow": "Noindex & Nofollow",
};

export function SeoPanel({
  value,
  onChange,
  fallback,
  status,
}: {
  value: SeoFormState;
  onChange: (patch: Partial<SeoFormState>) => void;
  fallback: { title: string; excerpt: string; coverImageUrl: string; slug: string };
  status: JournalStatus;
}) {
  const [expanded, setExpanded] = useState(false);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  const effectiveSeoTitle = value.seo_title.trim() || fallback.title;
  const effectiveMetaDescription = value.meta_description.trim() || fallback.excerpt;
  const effectiveSocialTitle = value.social_title.trim() || effectiveSeoTitle;
  const effectiveSocialDescription = value.social_description.trim() || effectiveMetaDescription;
  const effectiveSocialImage = value.social_image_url.trim() || fallback.coverImageUrl;
  const canonical = value.canonical_url.trim() || (fallback.slug ? journalArticleUrl(fallback.slug) : `${BASE_URL}/journal/`);

  const robotsChoice: RobotsChoice =
    !value.robots_index && !value.robots_follow
      ? "noindex-nofollow"
      : !value.robots_index
        ? "noindex-follow"
        : "index-follow";

  function setRobotsChoice(choice: RobotsChoice) {
    if (choice === "index-follow") onChange({ robots_index: true, robots_follow: true });
    else if (choice === "noindex-follow") onChange({ robots_index: false, robots_follow: true });
    else onChange({ robots_index: false, robots_follow: false });
  }

  const forcedNoindex = status !== "published";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="text-sm font-semibold text-gray-900">Search Engine Optimization</span>
        <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded ? (
        <div className="space-y-5 border-t border-gray-100 p-5">
          <Field label="Focus Keyword">
            <TextInput value={value.focus_keyword} onChange={(e) => onChange({ focus_keyword: e.target.value })} />
          </Field>

          <Field label="Secondary Keywords" hint={`Up to ${MAX_SECONDARY_KEYWORDS}, comma-separated`}>
            <TextInput
              value={value.secondary_keywords.join(", ")}
              onChange={(e) =>
                onChange({
                  secondary_keywords: e.target.value
                    .split(",")
                    .map((k) => k.trim())
                    .filter(Boolean)
                    .slice(0, MAX_SECONDARY_KEYWORDS),
                })
              }
            />
          </Field>

          <Field label="SEO Title" hint="Defaults to the article title if left blank">
            <TextInput
              value={value.seo_title}
              onChange={(e) => onChange({ seo_title: e.target.value })}
              placeholder={fallback.title}
            />
            <CharCount value={effectiveSeoTitle} min={SEO_TITLE_RECOMMENDED_MIN} max={SEO_TITLE_RECOMMENDED_MAX} />
          </Field>

          <Field label="Meta Description" hint="Defaults to the excerpt if left blank">
            <TextArea
              rows={2}
              value={value.meta_description}
              onChange={(e) => onChange({ meta_description: e.target.value })}
              placeholder={fallback.excerpt}
            />
            <CharCount
              value={effectiveMetaDescription}
              min={META_DESCRIPTION_RECOMMENDED_MIN}
              max={META_DESCRIPTION_RECOMMENDED_MAX}
            />
          </Field>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Google Search Preview</p>
            <p className="truncate text-sm text-[#1a0dab]">{effectiveSeoTitle}</p>
            <p className="text-xs text-[#006621]">{canonical}</p>
            <p className="mt-1 line-clamp-2 text-sm text-gray-600">{effectiveMetaDescription}</p>
          </div>

          <Field label="Social Title" hint="Defaults to the SEO title if left blank">
            <TextInput
              value={value.social_title}
              onChange={(e) => onChange({ social_title: e.target.value })}
              placeholder={effectiveSeoTitle}
            />
          </Field>
          <Field label="Social Description" hint="Defaults to the meta description if left blank">
            <TextArea
              rows={2}
              value={value.social_description}
              onChange={(e) => onChange({ social_description: e.target.value })}
              placeholder={effectiveMetaDescription}
            />
          </Field>
          <Field label="Social Sharing Image" hint="Defaults to the cover image if left blank">
            <TextInput
              value={value.social_image_url}
              onChange={(e) => onChange({ social_image_url: e.target.value })}
              placeholder={fallback.coverImageUrl}
            />
          </Field>

          <div className="rounded-xl border border-gray-100 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Social Share Preview</p>
            {effectiveSocialImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={effectiveSocialImage} alt="" className="mb-2 h-32 w-full rounded-lg object-cover" />
            ) : null}
            <p className="text-sm font-medium text-gray-900">{effectiveSocialTitle}</p>
            <p className="line-clamp-2 text-xs text-gray-500">{effectiveSocialDescription}</p>
          </div>

          <Field label="Search Indexing">
            <div className="space-y-2">
              {(Object.keys(ROBOTS_LABELS) as RobotsChoice[]).map((choice) => (
                <label key={choice} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="robots"
                    checked={robotsChoice === choice}
                    onChange={() => setRobotsChoice(choice)}
                  />
                  {ROBOTS_LABELS[choice]}
                </label>
              ))}
            </div>
            {forcedNoindex ? (
              <p className="mt-1 text-xs text-amber-600">
                This post isn&apos;t published, so it will be noindexed regardless of this setting.
              </p>
            ) : null}
          </Field>

          <div>
            <button
              type="button"
              onClick={() => setAdvancedExpanded((open) => !open)}
              className="text-xs font-medium text-gray-500 hover:text-gray-800"
            >
              {advancedExpanded ? "Hide" : "Show"} Advanced Settings
            </button>
            {advancedExpanded ? (
              <div className="mt-3">
                <Field label="Canonical URL" hint={`Defaults to ${canonical}`}>
                  <TextInput
                    value={value.canonical_url}
                    onChange={(e) => onChange({ canonical_url: e.target.value })}
                    placeholder={canonical}
                  />
                </Field>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
