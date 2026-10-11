"use client";

import { Hourglass } from "@phosphor-icons/react";

export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent-soft-foreground">
        <Hourglass className="size-7" aria-hidden />
      </span>
      <h1 className="text-title">{title}</h1>
      <p className="max-w-sm text-muted-foreground">{text}</p>
    </div>
  );
}
