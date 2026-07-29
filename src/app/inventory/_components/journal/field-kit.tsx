"use client";

import { cn } from "@/lib/utils";

export const inputClass =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100";

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-gray-400">{hint}</p> : null}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputClass, props.className)} />;
}

export function IconButton({
  onClick,
  title,
  children,
  variant = "default",
  disabled,
  type = "button",
}: {
  onClick?: () => void;
  title: string;
  children: React.ReactNode;
  variant?: "default" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        "rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40",
        variant === "danger" && "hover:bg-red-50 hover:text-red-600",
      )}
    >
      {children}
    </button>
  );
}

export function CharCount({
  value,
  min,
  max,
}: {
  value: string;
  min: number;
  max: number;
}) {
  const len = value.length;
  const inRange = len >= min && len <= max;
  return (
    <p className={cn("mt-1 text-xs", inRange ? "text-green-600" : "text-amber-600")}>
      {len} characters (recommended {min}-{max})
    </p>
  );
}
