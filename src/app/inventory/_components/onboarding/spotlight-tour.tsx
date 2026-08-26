"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { Button } from "@/app/inventory/_components/ui/button";
import type { SpotlightStep } from "@/app/inventory/_components/onboarding/onboarding-steps";

type SpotlightTourProps = {
  steps: SpotlightStep[];
  active: boolean;
  onDone: () => void;
};

type Rect = { top: number; left: number; width: number; height: number };

function findVisibleTarget(tourId: string): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${tourId}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? el : null;
}

export function SpotlightTour({ steps, active, onDone }: SpotlightTourProps) {
  const [mounted, setMounted] = useState(false);
  const [resolvedSteps, setResolvedSteps] = useState<SpotlightStep[]>([]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!active) return;
    const visible = steps.filter((step) => findVisibleTarget(step.tourId) !== null);
    setResolvedSteps(visible);
    setIndex(0);
    if (visible.length === 0) onDone();
    // Only re-resolve when the tour is (re)started, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const currentStep = resolvedSteps[index];

  useEffect(() => {
    if (!active || !currentStep) {
      setRect(null);
      return;
    }

    function measure() {
      const el = currentStep && findVisibleTarget(currentStep.tourId);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }

    const el = findVisibleTarget(currentStep.tourId);
    el?.scrollIntoView({ block: "nearest" });
    measure();

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, currentStep]);

  if (!mounted || !active || !currentStep || !rect) return null;

  const isLast = index === resolvedSteps.length - 1;
  const isNarrow = window.innerWidth < 640;

  const cardStyle: CSSProperties = isNarrow
    ? { position: "fixed", left: 16, right: 16, bottom: 16 }
    : {
        position: "fixed",
        top: Math.min(Math.max(rect.top, 16), window.innerHeight - 220),
        left: Math.min(rect.left + rect.width + 16, window.innerWidth - 336),
      };

  const ringBounds: CSSProperties = {
    top: rect.top - 6,
    left: rect.left - 6,
    width: rect.width + 12,
    height: rect.height + 12,
  };

  const ringGradient: CSSProperties = {
    ...ringBounds,
    padding: 3,
    background:
      "conic-gradient(from var(--spotlight-angle), #ff5f6d, #ffc371, #4ade80, #38bdf8, #a78bfa, #ff5f6d)",
    WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
    WebkitMaskComposite: "xor",
    maskComposite: "exclude",
    animation: "spotlight-spin 2.5s linear infinite",
    pointerEvents: "none",
  };

  return createPortal(
    <div className="fixed inset-0 z-200">
      <style>{`
        @property --spotlight-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes spotlight-spin {
          to { --spotlight-angle: 360deg; }
        }
      `}</style>
      <div
        className="fixed inset-0"
        onClick={() => {}}
        role="presentation"
      />
      <div
        aria-hidden
        className="fixed rounded-xl transition-[top,left,width,height] duration-150 ease-out"
        style={{
          ...ringBounds,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        className="fixed rounded-2xl transition-[top,left,width,height] duration-150 ease-out"
        style={{ ...ringGradient, filter: "blur(7px)", opacity: 0.8 }}
      />
      <div
        aria-hidden
        className="fixed rounded-2xl transition-[top,left,width,height] duration-150 ease-out"
        style={ringGradient}
      />
      <div
        style={cardStyle}
        className="w-[calc(100vw-2rem)] max-w-xs rounded-xl border border-border bg-card p-4 shadow-2xl sm:w-80"
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{currentStep.title}</p>
          <button
            type="button"
            onClick={onDone}
            aria-label="Close guide"
            className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">{currentStep.description}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Step {index + 1} of {resolvedSteps.length}
          </span>
          <div className="flex gap-2">
            {index > 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setIndex((i) => i - 1)}>
                Back
              </Button>
            ) : null}
            <Button type="button" size="sm" onClick={() => (isLast ? onDone() : setIndex((i) => i + 1))}>
              {isLast ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
