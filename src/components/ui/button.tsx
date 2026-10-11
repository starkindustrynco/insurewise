"use client";

import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { CircleNotch } from "@phosphor-icons/react";
import { cn } from "@/lib/utils/cn";

export const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,color,box-shadow,transform,border-color] duration-150 ease-out active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover",
        accent: "bg-accent text-accent-foreground shadow-xs hover:bg-accent-strong",
        secondary: "bg-surface text-foreground border border-border shadow-xs hover:bg-surface-muted hover:border-border-strong",
        soft: "bg-accent-soft text-accent-soft-foreground hover:brightness-[0.97] dark:hover:brightness-110",
        ghost: "text-foreground-soft hover:bg-surface-muted hover:text-foreground",
        danger: "bg-danger text-white hover:brightness-95",
        link: "h-auto px-0 text-accent-strong underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        sm: "h-8 rounded-md px-3 text-[0.8125rem] [&_svg]:size-4",
        md: "h-10 rounded-[0.625rem] px-4 text-sm [&_svg]:size-[1.125rem]",
        lg: "h-12 rounded-xl px-5 text-[0.9375rem] [&_svg]:size-5",
        icon: "size-10 rounded-[0.625rem] [&_svg]:size-5",
        "icon-sm": "size-8 rounded-md [&_svg]:size-[1.125rem]",
      },
      block: {
        true: "w-full",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, block }), className)}
        disabled={asChild ? undefined : disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading ? <CircleNotch className="animate-spin" aria-hidden /> : null}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";
