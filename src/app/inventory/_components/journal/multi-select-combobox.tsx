"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { inputClass } from "./field-kit";

export type ComboboxOption = { value: string; label: string; sublabel?: string };

export function MultiSelectCombobox({
  options,
  selected,
  onChange,
  placeholder = "Search…",
}: {
  options: ComboboxOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedOptions = selected
    .map((value) => options.find((o) => o.value === value))
    .filter((o): o is ComboboxOption => Boolean(o));

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={cn(inputClass, "flex items-center justify-between text-left")}>
            <span className="text-gray-500">
              {selectedOptions.length > 0 ? `${selectedOptions.length} selected` : placeholder}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-gray-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
          <Command>
            <CommandInput placeholder={placeholder} />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem key={option.value} value={option.label} onSelect={() => toggle(option.value)}>
                    <Check className={cn("h-4 w-4", selected.includes(option.value) ? "opacity-100" : "opacity-0")} />
                    <span>
                      {option.label}
                      {option.sublabel ? <span className="ml-1 text-xs text-gray-400">{option.sublabel}</span> : null}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedOptions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedOptions.map((option) => (
            <span
              key={option.value}
              className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600"
            >
              {option.label}
              <button type="button" onClick={() => toggle(option.value)} aria-label={`Remove ${option.label}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
