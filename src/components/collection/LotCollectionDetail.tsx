"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ChevronLeft, ChevronRight, Hash, Layers, LayoutGrid, Ruler, X } from "lucide-react";

import { FadeIn } from "@/components/animations/FadeIn";
import type { CollectionLot } from "@/lib/supabase/collection";

type LotCollectionDetailProps = {
  lot: CollectionLot;
  related: CollectionLot[];
};

export default function LotCollectionDetail({
  lot,
  related,
}: LotCollectionDetailProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const thumbStripRef = useRef<HTMLDivElement>(null);

  const imageCount = lot.images.length;
  const activeImg = lot.images[activeIndex]?.url ?? null;
  const hasMultiple = imageCount > 1;

  const showPrev = () =>
    setActiveIndex((i) => (i - 1 + imageCount) % imageCount);
  const showNext = () => setActiveIndex((i) => (i + 1) % imageCount);

  // Reset to the first image when navigating to a different lot.
  const [prevLotId, setPrevLotId] = useState(lot.id);
  if (prevLotId !== lot.id) {
    setPrevLotId(lot.id);
    setActiveIndex(0);
  }

  // Keep the active thumbnail visible without scrolling the page vertically.
  useEffect(() => {
    const strip = thumbStripRef.current;
    const thumb = strip?.children[activeIndex] as HTMLElement | undefined;
    if (!strip || !thumb) return;
    strip.scrollTo({
      left: thumb.offsetLeft - strip.clientWidth / 2 + thumb.clientWidth / 2,
      behavior: "smooth",
    });
  }, [activeIndex]);

  useEffect(() => {
    if (!isFullscreenOpen) {
      document.body.style.removeProperty("overflow");
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreenOpen(false);
      if (imageCount < 2) return;
      if (event.key === "ArrowLeft")
        setActiveIndex((i) => (i - 1 + imageCount) % imageCount);
      if (event.key === "ArrowRight")
        setActiveIndex((i) => (i + 1) % imageCount);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.removeProperty("overflow");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreenOpen, imageCount]);

  const whatsappText = encodeURIComponent(
    `Hi, I'm interested in the ${lot.marbleName}. Could you please share more details and pricing?`,
  );

  return (
    <>
      <div className="mx-auto min-h-screen w-full max-w-screen-2xl bg-background px-6 pb-24 pt-32 md:px-12 lg:px-24">
        <Link
          href="/collection"
          className="mb-12 flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Collection
        </Link>

        <div className="mb-24 grid grid-cols-1 gap-16 lg:grid-cols-2 lg:gap-24">
          <FadeIn className="space-y-6">
            {activeImg ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsFullscreenOpen(true)}
                  className="group relative block aspect-4/5 w-full cursor-zoom-in overflow-hidden bg-gray-100 text-left"
                  aria-label={`Open ${lot.marbleName} image fullscreen`}
                >
                  <Image
                    src={activeImg}
                    alt={lot.marbleName}
                    fill
                    className="object-cover transition-transform duration-1000 group-hover:scale-105"
                  />
                </button>
                {hasMultiple ? (
                  <>
                    <button
                      type="button"
                      onClick={showPrev}
                      className="absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-primary shadow-md backdrop-blur transition-colors hover:bg-white"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button
                      type="button"
                      onClick={showNext}
                      className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-primary shadow-md backdrop-blur transition-colors hover:bg-white"
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>
                    <span className="pointer-events-none absolute bottom-4 right-4 rounded-full bg-black/60 px-3 py-1 text-xs tracking-widest text-white">
                      {activeIndex + 1} / {imageCount}
                    </span>
                  </>
                ) : null}
              </div>
            ) : (
              <div className="aspect-4/5 w-full bg-gray-100" />
            )}

            {lot.images.length > 1 && (
              <div
                ref={thumbStripRef}
                className="hide-scrollbar relative flex gap-4 overflow-x-auto pb-4"
              >
                {lot.images.map((img, index) => (
                  <button
                    type="button"
                    key={`${lot.id}-${index}`}
                    onClick={() => setActiveIndex(index)}
                    className={`flex w-24 shrink-0 flex-col gap-2 text-left transition-all ${
                      activeIndex === index
                        ? "text-primary"
                        : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    <span
                      className={`overflow-hidden border-2 bg-gray-100 ${
                        activeIndex === index
                          ? "border-secondary"
                          : "border-transparent"
                      }`}
                    >
                      <Image
                        src={img.url}
                        alt={img.label}
                        width={96}
                        height={96}
                        className="h-24 w-24 object-cover"
                      />
                    </span>
                    <span className="text-xs uppercase tracking-[0.14em]">
                      {img.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </FadeIn>

          <FadeIn delay={0.2} className="flex flex-col justify-center">
            <div className="mb-4 flex items-center gap-3">
              {lot.categoryName ? (
                <span className="text-sm font-medium uppercase tracking-[0.2em] text-secondary">
                  {lot.categoryName}
                </span>
              ) : null}
              {lot.lotNumber ? (
                <>
                  {lot.categoryName && <span className="text-muted-foreground/40">·</span>}
                  <span className="font-mono text-sm font-medium text-muted-foreground">
                    {lot.lotNumber}
                  </span>
                </>
              ) : null}
            </div>
            <h1 className="mb-8 font-serif text-5xl text-primary md:text-6xl">
              {lot.marbleName}
            </h1>

            <div className="mb-8 grid grid-cols-2 gap-6">
              {lot.categoryName ? (
                <div>
                  <div className="mb-2 flex items-center gap-3 text-primary">
                    <Layers className="h-5 w-5 text-secondary" />
                    <h4 className="font-serif text-xl">Type</h4>
                  </div>
                  <p className="text-muted-foreground">{lot.categoryName}</p>
                </div>
              ) : null}
              {lot.thicknessName ? (
                <div>
                  <div className="mb-2 flex items-center gap-3 text-primary">
                    <Ruler className="h-5 w-5 text-secondary" />
                    <h4 className="font-serif text-xl">Thickness</h4>
                  </div>
                  <p className="text-muted-foreground">
                    {/^\d+(\.\d+)?$/.test(lot.thicknessName ?? "")
                      ? `${lot.thicknessName}mm`
                      : lot.thicknessName}
                  </p>
                </div>
              ) : null}
              {lot.slabCount > 0 ? (
                <div>
                  <div className="mb-2 flex items-center gap-3 text-primary">
                    <LayoutGrid className="h-5 w-5 text-secondary" />
                    <h4 className="font-serif text-xl">Slabs</h4>
                  </div>
                  <p className="text-muted-foreground">{lot.slabCount} slabs</p>
                </div>
              ) : null}
              {lot.totalSqft > 0 ? (
                <div>
                  <div className="mb-2 flex items-center gap-3 text-primary">
                    <Hash className="h-5 w-5 text-secondary" />
                    <h4 className="font-serif text-xl">Est. Sqft</h4>
                  </div>
                  <p className="text-muted-foreground">
                    {lot.totalSqft.toLocaleString("en-IN")} sqft
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mb-12 border-b border-border" />

            <a
              href={`https://wa.me/919099996869?text=${whatsappText}`}
              target="_blank"
              rel="noreferrer"
              className="group flex w-full items-center justify-center gap-3 bg-primary py-5 text-sm uppercase tracking-widest text-white! transition-colors duration-300 hover:bg-secondary"
            >
              Inquire About This Stone
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </FadeIn>
        </div>

        {related.length > 0 && (
          <FadeIn>
            <h3 className="mb-12 text-center font-serif text-3xl text-primary">
              Related Selection
            </h3>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {related.map((item, index) => (
                <FadeIn key={item.id} direction="scale" delay={index * 0.12}>
                  <Link href={`/collection/${item.id}`} className="group block h-full">
                    <div className="relative mb-6 aspect-3/4 overflow-hidden bg-gray-100">
                      {item.thumbnailUrl ? (
                        <Image
                          src={item.thumbnailUrl}
                          alt={item.marbleName}
                          fill
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : null}
                    </div>
                    <div className="transition-transform duration-500 group-hover:-translate-y-1">
                      <h3 className="mb-2 font-serif text-2xl text-primary">
                        {item.marbleName}
                      </h3>
                      <p className="text-sm uppercase tracking-widest text-muted-foreground">
                        {item.categoryName}
                      </p>
                    </div>
                  </Link>
                </FadeIn>
              ))}
            </div>
          </FadeIn>
        )}
      </div>

      {isFullscreenOpen && activeImg ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4 py-6 md:px-8"
          onClick={() => setIsFullscreenOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${lot.marbleName} fullscreen preview`}
        >
          <button
            type="button"
            onClick={() => setIsFullscreenOpen(false)}
            className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Close fullscreen preview"
          >
            <X className="h-5 w-5" />
          </button>
          {hasMultiple ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                showPrev();
              }}
              className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          ) : null}
          <Image
            src={activeImg}
            alt={lot.marbleName}
            width={1920}
            height={2400}
            className="max-h-full max-w-full object-contain"
            onClick={(event) => event.stopPropagation()}
          />
          {hasMultiple ? (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  showNext();
                }}
                className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="Next image"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm tracking-widest text-white/70">
                {activeIndex + 1} / {imageCount}
              </span>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
