import Image from "next/image";
import Link from "next/link";

import type { ContentBlock } from "@/lib/journal/types";
import { buildHeadingIdsByBlockId } from "@/lib/journal/toc";
import { parseInlineRichText } from "@/lib/journal/rich-text";
import { isSafeUrl, isSafeWhatsAppUrl, parseVideoEmbedUrl } from "@/lib/journal/sanitize-url";
import type { CollectionLot } from "@/lib/supabase/collection";

function Prose({ text }: { text: string }) {
  return <>{parseInlineRichText(text)}</>;
}

function ImageBlockView({ block }: { block: Extract<ContentBlock, { type: "image" }> }) {
  if (!block.data.url || !isSafeUrl(block.data.url)) return null;
  return (
    <figure className="my-8">
      <div className="relative w-full overflow-hidden rounded-lg bg-gray-100" style={{ aspectRatio: "16 / 9" }}>
        <Image
          src={block.data.url}
          alt={block.data.alt}
          fill
          loading="lazy"
          className="object-cover"
        />
      </div>
      {block.data.caption ? (
        <figcaption className="mt-2 text-center text-sm text-muted-foreground">{block.data.caption}</figcaption>
      ) : null}
    </figure>
  );
}

function ProductCardView({
  block,
  productLookup,
}: {
  block: Extract<ContentBlock, { type: "product-card" }>;
  productLookup: Map<string, CollectionLot>;
}) {
  const product = productLookup.get(block.data.marbleLotId);
  if (!product) return null;
  return (
    <Link
      href={`/collection/${product.id}`}
      className="my-8 flex items-center gap-4 rounded-xl border border-border p-4 transition-colors hover:border-secondary"
    >
      {product.thumbnailUrl ? (
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
          <Image src={product.thumbnailUrl} alt={product.marbleName} fill loading="lazy" className="object-cover" />
        </div>
      ) : null}
      <div>
        <p className="font-serif text-lg text-primary">{product.marbleName}</p>
        {block.data.note ? <p className="text-sm text-muted-foreground">{block.data.note}</p> : null}
        <span className="text-xs uppercase tracking-wider text-secondary">View in Collection →</span>
      </div>
    </Link>
  );
}

function CtaButton({ block }: { block: Extract<ContentBlock, { type: "inquiry-cta" }> }) {
  const { destinationType, destinationValue, buttonLabel } = block.data;
  const safe =
    destinationType === "whatsapp" ? isSafeWhatsAppUrl(destinationValue) : isSafeUrl(destinationValue);
  if (!safe) return null;

  const href =
    destinationType === "whatsapp" && !/^https?:\/\//.test(destinationValue)
      ? `https://wa.me/${destinationValue.replace(/[^0-9]/g, "")}`
      : destinationValue;

  return (
    <div className="my-10 rounded-2xl bg-primary px-6 py-8 text-center text-white">
      <p className="font-serif text-2xl">{block.data.heading}</p>
      {block.data.body ? <p className="mt-2 text-white/80">{block.data.body}</p> : null}
      <Link
        href={href}
        target={destinationType === "whatsapp" ? "_blank" : undefined}
        rel={destinationType === "whatsapp" ? "noopener noreferrer" : undefined}
        className="mt-5 inline-block rounded-full bg-secondary px-6 py-3 text-sm font-medium uppercase tracking-wider text-primary"
      >
        {buttonLabel}
      </Link>
    </div>
  );
}

export function BlockRenderer({
  content,
  productLookup,
}: {
  content: ContentBlock[];
  productLookup: Map<string, CollectionLot>;
}) {
  const headingIds = buildHeadingIdsByBlockId(content);

  return (
    <div className="space-y-6 text-[1.0625rem] leading-8 text-muted-foreground">
      {content.map((block) => {
        switch (block.type) {
          case "paragraph":
            return block.data.text.trim() ? (
              <p key={block.id}>
                <Prose text={block.data.text} />
              </p>
            ) : null;

          case "heading": {
            const id = headingIds.get(block.id);
            const text = block.data.text.trim();
            if (!text) return null;
            return block.data.level === 2 ? (
              <h2 key={block.id} id={id} className="scroll-mt-24 font-serif text-3xl text-primary">
                {text}
              </h2>
            ) : (
              <h3 key={block.id} id={id} className="scroll-mt-24 font-serif text-2xl text-primary">
                {text}
              </h3>
            );
          }

          case "image":
            return <ImageBlockView key={block.id} block={block} />;

          case "bulleted-list":
            return (
              <ul key={block.id} className="list-disc space-y-2 pl-6">
                {block.data.items.filter(Boolean).map((item, i) => (
                  <li key={i}>
                    <Prose text={item} />
                  </li>
                ))}
              </ul>
            );

          case "numbered-list":
            return (
              <ol key={block.id} className="list-decimal space-y-2 pl-6">
                {block.data.items.filter(Boolean).map((item, i) => (
                  <li key={i}>
                    <Prose text={item} />
                  </li>
                ))}
              </ol>
            );

          case "quote":
            return (
              <blockquote key={block.id} className="border-l-2 border-secondary pl-6 font-serif text-xl italic text-primary">
                <Prose text={block.data.text} />
                {block.data.attribution ? (
                  <footer className="mt-2 text-sm not-italic text-muted-foreground">— {block.data.attribution}</footer>
                ) : null}
              </blockquote>
            );

          case "comparison-table":
            return (
              <div key={block.id} className="my-8">
                {block.data.caption ? <p className="mb-2 text-sm font-medium text-primary">{block.data.caption}</p> : null}
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        {block.data.columns.map((col, i) => (
                          <th key={i} scope="col" className="p-3 text-left font-medium text-primary">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.data.rows.map((row, ri) => (
                        <tr key={ri} className="border-t border-border">
                          {row.map((cell, ci) => (
                            <td key={ci} className="p-3">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );

          case "key-takeaway":
            return (
              <div key={block.id} className="my-8 rounded-xl border border-secondary/30 bg-secondary/5 p-5">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-secondary">
                  {block.data.title || "Key Takeaway"}
                </p>
                <p className="text-primary">
                  <Prose text={block.data.text} />
                </p>
              </div>
            );

          case "product-card":
            return <ProductCardView key={block.id} block={block} productLookup={productLookup} />;

          case "project-card":
            return (
              <div key={block.id} className="my-8 overflow-hidden rounded-xl border border-border">
                {block.data.imageUrl ? (
                  <div className="relative aspect-video w-full bg-gray-100">
                    <Image src={block.data.imageUrl} alt={block.data.title} fill loading="lazy" className="object-cover" />
                  </div>
                ) : null}
                <div className="p-5">
                  <p className="font-serif text-lg text-primary">{block.data.title}</p>
                  {block.data.description ? <p className="mt-1 text-sm">{block.data.description}</p> : null}
                  {block.data.url && isSafeUrl(block.data.url) ? (
                    <Link href={block.data.url} className="mt-2 inline-block text-xs uppercase tracking-wider text-secondary">
                      View Project →
                    </Link>
                  ) : null}
                </div>
              </div>
            );

          case "inquiry-cta":
            return <CtaButton key={block.id} block={block} />;

          case "faq-section": {
            const faqs = block.data.faqs.filter((faq) => faq.question.trim() && faq.answer.trim());
            if (faqs.length === 0) return null;
            return (
              <div key={block.id} className="my-8 space-y-3">
                <h2 className="font-serif text-2xl text-primary">Frequently Asked Questions</h2>
                {faqs.map((faq) => (
                  <details key={faq.id} className="group rounded-xl border border-border p-4">
                    <summary className="cursor-pointer list-none font-medium text-primary">{faq.question}</summary>
                    <p className="mt-2 text-sm">{faq.answer}</p>
                  </details>
                ))}
              </div>
            );
          }

          case "video-embed": {
            const parsed = parseVideoEmbedUrl(block.data.url);
            if (!parsed) return null;
            return (
              <figure key={block.id} className="my-8">
                <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
                  <iframe
                    src={parsed.embedUrl}
                    title={block.data.caption || "Embedded video"}
                    className="absolute inset-0 h-full w-full"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                {block.data.caption ? (
                  <figcaption className="mt-2 text-center text-sm text-muted-foreground">{block.data.caption}</figcaption>
                ) : null}
              </figure>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
}
