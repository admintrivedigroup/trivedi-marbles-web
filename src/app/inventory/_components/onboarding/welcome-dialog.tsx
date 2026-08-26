"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/app/inventory/_components/ui/dialog";
import { Button } from "@/app/inventory/_components/ui/button";
import { cn } from "@/lib/utils";
import { WELCOME_SLIDES } from "@/app/inventory/_components/onboarding/onboarding-steps";

type WelcomeDialogProps = {
  open: boolean;
  onSkip: () => void;
  onContinue: () => void;
};

export function WelcomeDialog({ open, onSkip, onContinue }: WelcomeDialogProps) {
  const [index, setIndex] = useState(0);

  // Reset to the first slide whenever the dialog transitions to open
  // (adjusting state during render, per React's guidance for this case).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setIndex(0);
  }

  const isLast = index === WELCOME_SLIDES.length - 1;
  const slide = WELCOME_SLIDES[index];
  const Icon = slide.icon;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onSkip(); }}>
      <DialogContent className="sm:max-w-md" onEscapeKeyDown={onSkip}>
        <div className="flex flex-col items-center gap-4 pt-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="h-7 w-7" />
          </div>
          <div className="space-y-1.5">
            <DialogTitle className="text-lg leading-normal font-semibold text-foreground">
              {slide.title}
            </DialogTitle>
            <DialogDescription>{slide.description}</DialogDescription>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 py-2">
          {WELCOME_SLIDES.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-5 bg-primary" : "w-1.5 bg-muted",
              )}
            />
          ))}
        </div>

        <div className="flex items-center justify-between pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
            Skip
          </Button>
          <div className="flex gap-2">
            {index > 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setIndex((i) => i - 1)}>
                Back
              </Button>
            ) : null}
            <Button type="button" size="sm" onClick={() => (isLast ? onContinue() : setIndex((i) => i + 1))}>
              {isLast ? "Show me around" : "Next"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
