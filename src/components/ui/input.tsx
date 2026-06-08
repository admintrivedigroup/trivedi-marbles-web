"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const isPasswordInput = type === "password";

  const input = (
    <input
      type={isPasswordInput && passwordVisible ? "text" : type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md border border-border bg-white px-3 py-1 text-base outline-none transition-[color,box-shadow] selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:border-secondary focus-visible:ring-[3px] focus-visible:ring-secondary/30 md:text-sm",
        className,
        isPasswordInput && "pr-12",
      )}
      {...props}
    />
  );

  if (!isPasswordInput) {
    return input;
  }

  return (
    <div className="relative">
      {input}
      <button
        type="button"
        aria-label={passwordVisible ? "Hide password" : "Show password"}
        aria-pressed={passwordVisible}
        onClick={() => setPasswordVisible((current) => !current)}
        disabled={props.disabled}
        className="absolute inset-y-0 right-0 flex items-center justify-center rounded-r-md px-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        {passwordVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export { Input };
