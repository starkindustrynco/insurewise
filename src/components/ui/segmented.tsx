"use client";

import * as React from "react";
import { ToggleGroup } from "radix-ui";
import { cn } from "@/lib/utils/cn";

interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

/** Single-select segmented control. Always keeps one value selected. */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
  size = "md",
  wrap = false,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedOption<T>[];
  label: string;
  className?: string;
  size?: "sm" | "md";
  wrap?: boolean;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onValueChange(v as T);
      }}
      aria-label={label}
      className={cn(
        "scrollbar-none inline-flex max-w-full items-center gap-1 rounded-xl bg-surface-muted p-1",
        wrap ? "flex-wrap" : "relative overflow-x-auto",
        className,
      )}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className={cn(
            "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=on]:bg-surface data-[state=on]:text-foreground data-[state=on]:shadow-xs [&_svg]:size-4",
            size === "sm" ? "h-8 text-[0.8125rem]" : "h-9 text-sm",
          )}
        >
          {o.icon}
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
