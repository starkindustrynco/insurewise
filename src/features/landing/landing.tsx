"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ChatCircleText, Hospital, IdentificationCard, ShieldCheck } from "@phosphor-icons/react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ScoreRing } from "@/components/verdict/score-ring";
import { StatusIcon } from "@/components/verdict/checklist";
import { useApp } from "@/store/app-store";

const PREVIEW = [
  { status: "does-not-meet" as const, title: "Any room, no rent cap", value: "Capped at ₹5,000 a day" },
  { status: "partial" as const, title: "You don't share the bill", value: "10% from age 61" },
  { status: "meets" as const, title: "Short procedures covered", value: "Covered" },
];

export function Landing() {
  const onboarded = useApp((s) => s.onboarded);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Logo />
        {ready && onboarded ? (
          <Button asChild variant="secondary" size="sm">
            <Link href="/app">Open my cover</Link>
          </Button>
        ) : null}
      </header>

      <main id="main" className="mx-auto grid max-w-5xl gap-12 px-5 pb-16 pt-6 md:grid-cols-[1.1fr_1fr] md:items-center md:pt-14">
        <section className="flex flex-col gap-6">
          <h1 className="text-display">Know what your health policy covers before the hospital tells you.</h1>
          <p className="max-w-xl text-[1.0625rem] leading-relaxed text-foreground-soft">
            Upload your policy. In about a minute you'll see what's strong, what's missing and what to watch for, in plain words, with the page it
            came from.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="sm:w-auto">
              <Link href={ready && onboarded ? "/app" : "/start"}>
                {ready && onboarded ? "Open my cover" : "Check my policy"} <ArrowRight weight="bold" aria-hidden />
              </Link>
            </Button>
          </div>
          <ul className="grid gap-3 text-support text-foreground-soft sm:grid-cols-3">
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden /> A score and checklist anyone can read
            </li>
            <li className="flex items-start gap-2">
              <ChatCircleText className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden /> Ask questions, in your language
            </li>
            <li className="flex items-start gap-2">
              <IdentificationCard className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden /> A hospital-ready card for each member
            </li>
          </ul>
        </section>

        <section aria-label="Example result" className="surface-card mx-auto w-full max-w-sm p-5 shadow-raised">
          <p className="label-caps text-muted-foreground">Example · sample policy</p>
          <div className="mt-3 flex items-center gap-4">
            <ScoreRing score={40} label="Needs attention" size={104} />
            <div>
              <p className="text-heading">Needs attention</p>
              <p className="text-support text-muted-foreground">1 of 7 must-haves · 1 red flag</p>
            </div>
          </div>
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
            {PREVIEW.map((r) => (
              <li key={r.title} className="flex items-center gap-3 px-3 py-2.5">
                <StatusIcon status={r.status} className="size-5" />
                <span className="min-w-0">
                  <span className="block text-[0.875rem] font-medium">{r.title}</span>
                  <span className="block text-[0.8rem] text-muted-foreground">{r.value}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="mx-auto flex max-w-5xl flex-col gap-3 border-t border-border px-5 py-6 text-support text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>Hackathon demo. InsureWise explains your documents; only your insurer decides claims.</p>
        <nav className="flex gap-4" aria-label="Demo portals">
          <Link href="/hospital" className="inline-flex items-center gap-1.5 hover:text-foreground">
            <Hospital className="size-4" aria-hidden /> Hospital demo
          </Link>
          <Link href="/advisor" className="hover:text-foreground">
            Advisor demo
          </Link>
        </nav>
      </footer>
    </div>
  );
}
