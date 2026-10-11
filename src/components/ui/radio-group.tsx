"use client";

import * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils/cn";

export const RadioGroup = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => <RadioGroupPrimitive.Root ref={ref} className={cn("grid gap-2", className)} {...props} />);
RadioGroup.displayName = "RadioGroup";

/** A large, card-like radio option used for choices with a description. */
export const RadioCard = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> & {
    title: React.ReactNode;
    description?: React.ReactNode;
    icon?: React.ReactNode;
    meta?: React.ReactNode;
  }
>(({ className, title, description, icon, meta, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      "group relative flex w-full min-w-0 items-start gap-3 rounded-xl border border-border bg-surface p-4 text-left shadow-xs transition-[border-color,box-shadow,background-color] hover:border-border-strong data-[state=checked]:border-accent data-[state=checked]:bg-accent-soft/40 data-[state=checked]:ring-1 data-[state=checked]:ring-accent disabled:cursor-not-allowed disabled:opacity-60",
      className,
    )}
    {...props}
  >
    {icon ? (
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-muted text-foreground-soft group-data-[state=checked]:bg-accent group-data-[state=checked]:text-accent-foreground [&_svg]:size-5">
        {icon}
      </span>
    ) : null}
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-foreground">
        {title}
        {meta}
      </span>
      {description ? <span className="text-support text-muted-foreground">{description}</span> : null}
    </span>
    <span
      aria-hidden
      className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-border-strong bg-surface group-data-[state=checked]:border-accent"
    >
      <RadioGroupPrimitive.Indicator className="size-2.5 rounded-full bg-accent" />
    </span>
  </RadioGroupPrimitive.Item>
));
RadioCard.displayName = "RadioCard";
