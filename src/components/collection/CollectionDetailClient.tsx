"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ChevronRight, Droplet, Layers, Ruler, X } from "lucide-react";

import { FadeIn } from "@/components/animations/FadeIn";
import { Marble, marbles } from "@/data/marbles";

type CollectionDetailClientProps = {
  marble: Marble;
};

export default function CollectionDetailClient({
  marble,
}: CollectionDetailClientProps) {
  const [activeImg, setActiveImg] = useState(marble.image);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const sameColor = marbles.filter((item) => item.id !== marble.id && item.color === marble.color);
  const relatedMarbles = (sameColor.length >= 3 ? sameColor : [...sameColor, ...marbles.filter((item) => item.id !== marble.id && item.color !== marble.color)]).slice(0, 3);
  const imageOptions = [
    { image: marble.image, name: marble.imageName },
    ...marble.gallery,
  ];

  useEffect(() => {
    if (!isFullscreenOpen) {
      document.body.style.removeProperty("overflow");
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreenOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.removeProperty("overflow");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreenOpen]);

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
          <button
            type="button"
            onClick={() => setIsFullscreenOpen(true)}
            className="group relative block aspect-4/5 w-full cursor-zoom-in overflow-hidden bg-gray-100 text-left"
            aria-label={`Open ${marble.name} image fullscreen`}
          >
            <Image
              src={activeImg}
              alt={marble.name}
              fill
              className="object-cover transition-transform duration-1000 group-hover:scale-105"
            />
          </button>
          <div className="hide-scrollbar flex gap-4 overflow-x-auto pb-4">
            {imageOptions.map((item, index) => (
              <button
                type="button"
                key={`${marble.id}-${index}`}
                onClick={() => setActiveImg(item.image)}
                className={`flex w-24 shrink-0 flex-col gap-2 text-left transition-all ${
                  activeImg === item.image
                    ? "text-primary"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                <span
                  className={`overflow-hidden border-2 bg-gray-100 ${
                    activeImg === item.image
                      ? "border-secondary"
                      : "border-transparent"
                  }`}
                >
                  <Image src={item.image} alt={item.name} width={96} height={96} className="h-24 w-24 object-cover" />
                </span>
                <span className="text-xs uppercase tracking-[0.14em]">
                  {item.name}
                </span>
              </button>
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={0.2} className="flex flex-col justify-center">
          <span className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-secondary">
            {marble.origin}
          </span>
          <h1 className="mb-8 font-serif text-5xl text-primary md:text-6xl">
            {marble.name}
          </h1>
          <p className="mb-12 border-b border-border pb-12 text-lg leading-relaxed text-muted-foreground">
            {marble.description}
          </p>

          <div className="mb-12 grid grid-cols-2 gap-8">
            <div>
              <div className="mb-2 flex items-center gap-3 text-primary">
                <Droplet className="h-5 w-5 text-secondary" />
                <h4 className="font-serif text-xl">Color</h4>
              </div>
              <p className="text-muted-foreground">{marble.color}</p>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-3 text-primary">
                <Layers className="h-5 w-5 text-secondary" />
                <h4 className="font-serif text-xl">Finish</h4>
              </div>
              <p className="text-muted-foreground">{marble.finish}</p>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-3 text-primary">
                <Ruler className="h-5 w-5 text-secondary" />
                <h4 className="font-serif text-xl">Thickness</h4>
              </div>
              <p className="text-muted-foreground">{marble.thickness}</p>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-3 text-primary">
                <Droplet className="h-5 w-5 text-secondary" />
                <h4 className="font-serif text-xl">Applications</h4>
              </div>
              <p className="text-muted-foreground">{marble.applications}</p>
            </div>
          </div>

          <a
            href={`https://wa.me/919099996869?text=${encodeURIComponent(`Hi, I'm interested in the ${marble.name}. Could you please share more details and pricing?`)}`}
            target="_blank"
            rel="noreferrer"
            className="group flex w-full items-center justify-center gap-3 bg-primary py-5 text-sm uppercase tracking-widest text-white! transition-colors duration-300 hover:bg-secondary"
          >
            Inquire About This Stone
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </a>
        </FadeIn>
      </div>

      <FadeIn>
        <h3 className="mb-12 text-center font-serif text-3xl text-primary">
          Related Selection
        </h3>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {relatedMarbles.map((item, index) => (
            <FadeIn key={item.id} direction="scale" delay={index * 0.12}>
            <Link href={`/collection/${item.id}`} className="group block h-full">
              <div className="relative mb-6 aspect-3/4 overflow-hidden bg-gray-100">
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="transition-transform duration-500 group-hover:-translate-y-1">
              <h3 className="mb-2 font-serif text-2xl text-primary">{item.name}</h3>
              <p className="text-sm uppercase tracking-widest text-muted-foreground">
                {item.finish}
              </p>
              </div>
            </Link>
            </FadeIn>
          ))}
        </div>
      </FadeIn>
      </div>

      {isFullscreenOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4 py-6 md:px-8"
          onClick={() => setIsFullscreenOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${marble.name} fullscreen preview`}
        >
          <button
            type="button"
            onClick={() => setIsFullscreenOpen(false)}
            className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Close fullscreen preview"
          >
            <X className="h-5 w-5" />
          </button>
          <Image
            src={activeImg}
            alt={marble.name}
            width={1920}
            height={2400}
            className="max-h-full max-w-full object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
