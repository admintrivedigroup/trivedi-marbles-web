"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { JournalCategory } from "@/lib/journal/types";
import { inputClass } from "./field-kit";

export function CategoryCombobox({
  categories,
  value,
  onChange,
}: {
  categories: JournalCategory[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isKnownCategory = categories.some((c) => c.name === value);

  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={cn(inputClass, "flex items-center justify-between text-left")}>
            <span className={value ? "text-foreground" : "text-gray-400"}>{value || "Select a category…"}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-gray-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
          <Command>
            <CommandInput placeholder="Search categories…" />
            <CommandList>
              <CommandEmpty>No category found.</CommandEmpty>
              <CommandGroup>
                {categories.map((category) => (
                  <CommandItem
                    key={category.id}
                    value={category.name}
                    onSelect={() => {
                      onChange(category.name);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("h-4 w-4", value === category.name ? "opacity-100" : "opacity-0")} />
                    {category.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {!isKnownCategory && value ? (
        <p className="mt-1 text-xs text-amber-600">
          &ldquo;{value}&rdquo; is not in the current category list — needs review.
        </p>
      ) : null}
    </div>
  );
}
