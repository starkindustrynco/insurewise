import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

export const badgeVariants = cva(
  "inline-flex max-w-full items-center gap-1.5 rounded-full border font-medium leading-none whitespace-nowrap [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "border-transparent bg-neutral-soft text-neutral-foreground",
        accent: "border-transparent bg-accent-soft text-accent-soft-foreground",
        success: "border-transparent bg-success-soft text-success-foreground",
        warning: "border-transparent bg-warning-soft text-warning-foreground",
        danger: "border-transparent bg-danger-soft text-danger-foreground",
        info: "border-transparent bg-info-soft text-info-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
        ink: "border-transparent bg-primary text-primary-foreground",
      },
      size: {
        sm: "h-6 px-2 text-[0.75rem] [&_svg]:size-3.5",
        md: "h-7 px-2.5 text-[0.8125rem] [&_svg]:size-4",
      },
    },
    defaultVariants: { tone: "neutral", size: "sm" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}
