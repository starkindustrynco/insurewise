"use client";

import * as React from "react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import { CaretDown } from "@phosphor-icons/react";
import { cn } from "@/lib/utils/cn";

export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({ className, ...props }: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item className={cn("border-b border-border last:border-b-0", className)} {...props} />;
}

export function AccordionTrigger({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          "group flex min-h-12 flex-1 items-center justify-between gap-3 py-3 text-left text-[0.9375rem] font-medium text-foreground transition-colors hover:text-accent-strong",
          className,
        )}
        {...props}
      >
        {children}
        <CaretDown
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content className="overflow-hidden" {...props}>
      <div className={cn("pb-4 text-support text-foreground-soft", className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}
