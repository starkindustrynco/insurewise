"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { PolicyIntake } from "./policy-intake";
import { activePolicy, useApp } from "@/store/app-store";
import type { Policy } from "@/domain/types";
import type { ReadFile } from "@/lib/intake";

/** Files of a stored policy, rebuilt from its pages so more can be added and the whole set re-read. */
function filesOf(p: Policy): ReadFile[] {
  const byFile = new Map<string, string[]>();
  p.pageRefs.forEach((r, i) => byFile.set(r.file, [...(byFile.get(r.file) ?? []), p.pages[i] ?? ""]));
  return [...byFile.entries()].map(([name, pages]) => ({ name, pages, size: 0 }));
}

export function AddPolicy() {
  const router = useRouter();
  const params = useSearchParams();
  const members = useApp((s) => s.members);
  const current = useApp((s) => activePolicy(s));
  const addPolicy = useApp((s) => s.addPolicy);
  const replace = params.get("to") === "current" && current;

  return (
    <div className="flex flex-col gap-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/app">
          <ArrowLeft aria-hidden /> My cover
        </Link>
      </Button>
      <div className="flex flex-col gap-1">
        <h1 className="text-title">{replace ? "Add a document" : "Add another policy"}</h1>
        <p className="text-muted-foreground">
          {replace
            ? `We'll read it together with what you already uploaded for ${current.label}.`
            : "For example your employer's group cover or your parents' policy. We'll compare them for you."}
        </p>
      </div>
      <PolicyIntake
        compact
        members={members}
        initialFiles={replace ? filesOf(current) : undefined}
        onDone={(p) => {
          addPolicy(replace ? { ...p, id: current.id, answers: { ...current.answers, ...p.answers } } : p);
          router.push("/app");
        }}
      />
    </div>
  );
}
