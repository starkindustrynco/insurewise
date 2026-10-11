"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarCheck, Clock, IdentificationCard, Info, Plus, Sparkle, WarningCircle, WarningOctagon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checklist } from "@/components/verdict/checklist";
import { LABEL_TONE, ScoreRing } from "@/components/verdict/score-ring";
import { coverText, nextStepsFor, tidyName, verdictFor, coPayFor } from "@/domain/policy/framework";
import { coverStart, formatDate, waitingFor } from "@/domain/policy/waiting";
import { activePolicy, useApp } from "@/store/app-store";
import { RELATION_LABEL } from "@/features/onboarding/step-family";
import { cn } from "@/lib/utils/cn";

const TONE_ICON = { danger: WarningOctagon, warning: WarningCircle, info: Info } as const;
const TONE_CLASS = {
  danger: "border-danger/30 bg-danger-soft/60 [&_svg]:text-danger",
  warning: "border-warning/40 bg-warning-soft/60 [&_svg]:text-warning-foreground",
  info: "border-info/30 bg-info-soft/60 [&_svg]:text-info",
} as const;

export function MyCover() {
  const router = useRouter();
  const policies = useApp((s) => s.policies);
  const activeId = useApp((s) => s.activePolicyId);
  const members = useApp((s) => s.members);
  const setActive = useApp((s) => s.setActivePolicy);
  const policy = activePolicy({ policies, activePolicyId: activeId });

  if (!policy)
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-heading">No policy yet</p>
        <Button asChild>
          <Link href="/app/add">Add your policy</Link>
        </Button>
      </div>
    );

  const v = verdictFor(policy.checks);
  const steps = nextStepsFor(
    policy,
    members.filter((m) => policy.memberIds.includes(m.id)),
  );
  const covered = members.filter((m) => policy.memberIds.includes(m.id));
  // Maternity only matters if someone covered could plausibly use it.
  const waits = waitingFor(policy).filter((w) => w.kind !== "maternity" || covered.some((m) => m.age >= 18 && m.age <= 45));
  const cover = coverText(policy);
  const ask = (q: string) => router.push(`/app/ask?q=${encodeURIComponent(q)}`);

  return (
    <div className="flex flex-col gap-7">
      {policies.length > 1 ? (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none" role="tablist" aria-label="Your policies">
          {policies.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={p.id === policy.id}
              onClick={() => setActive(p.id)}
              className={cn(
                "h-9 shrink-0 rounded-full border px-4 text-[0.875rem] font-medium",
                p.id === policy.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground-soft",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* Verdict */}
      <section aria-labelledby="verdict" className="surface-card flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-0.5">
          <p className="label-caps text-muted-foreground">{policy.facts.insurerName ? tidyName(policy.facts.insurerName) : "Your policy"}</p>
          <h1 id="verdict" className="text-title">
            {policy.label}
          </h1>
        </div>
        <div className="flex items-center gap-5">
          <ScoreRing score={v.score} label={v.label} />
          <div className="flex min-w-0 flex-col gap-2">
            <Badge tone={LABEL_TONE[v.label]} size="md" className="self-start">
              {v.label}
            </Badge>
            <p className="text-[1rem] font-medium leading-snug">
              {v.mustMet} of {v.mustTotal} must-haves
              {v.redFlags.length ? (
                <span className="text-danger-foreground">
                  {" "}
                  · {v.redFlags.length} red {v.redFlags.length === 1 ? "flag" : "flags"}
                </span>
              ) : null}
            </p>
            <p className="text-support text-muted-foreground">
              {v.goodMet} of {v.goodTotal} good-to-haves{cover ? ` · ${cover}` : ""}
            </p>
          </div>
        </div>
        <p className="flex items-start gap-2 text-[0.8rem] text-muted-foreground">
          <Sparkle className="mt-0.5 size-4 shrink-0 text-accent" weight="fill" aria-hidden />
          {policy.ai.live
            ? `Read by Google Gemini · ${policy.ai.verified} of ${policy.ai.quoted} quotes found word for word in your document. AI can make mistakes; tap any row to see the clause.`
            : "Sample policy read by InsureWise's built-in engine. Tap any row to see the clause."}
        </p>
      </section>

      {/* What to do */}
      {steps.length ? (
        <section aria-labelledby="todo" className="flex flex-col gap-2.5">
          <h2 id="todo" className="text-heading px-1">
            What to do about it
          </h2>
          {steps.map((s) => {
            const Icon = TONE_ICON[s.tone];
            return (
              <div key={s.id} className={cn("flex items-start gap-3 rounded-2xl border p-3.5", TONE_CLASS[s.tone])}>
                <Icon className="mt-0.5 size-5 shrink-0" weight="fill" aria-hidden />
                <div>
                  <p className="font-medium leading-snug">{s.title}</p>
                  <p className="text-support text-foreground-soft">{s.detail}</p>
                  {s.id.startsWith("missing") ? (
                    <Link href="/app/add?to=current" className="mt-1 inline-block text-support font-medium text-accent-strong hover:underline">
                      Upload it
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {/* Checklist */}
      <Checklist checks={policy.checks} refs={policy.pageRefs} onAsk={ask} />

      {/* Waiting periods */}
      {waits.length ? (
        <section aria-labelledby="waits" className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between px-1">
            <h2 id="waits" className="text-heading">
              Waiting periods
            </h2>
            <span className="text-support text-muted-foreground">Counted from your first policy date</span>
          </div>
          <ul className="surface-card divide-y divide-border">
            {waits.map((w) => (
              <li key={w.kind} className="flex flex-col gap-2 px-4 py-3.5">
                <div className="flex items-start gap-3">
                  {w.done ? (
                    <CalendarCheck className="mt-0.5 size-5 shrink-0 text-success" weight="fill" aria-hidden />
                  ) : (
                    <Clock className="mt-0.5 size-5 shrink-0 text-warning-foreground" weight="fill" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{w.title}</p>
                    <p className="text-support text-muted-foreground">{w.detail}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("text-[0.875rem] font-semibold", w.done ? "text-success-foreground" : "text-foreground")}>
                      {w.endsOn ? (w.done ? "Done" : `${w.daysLeft} days left`) : w.length}
                    </p>
                    <p className="text-[0.75rem] text-muted-foreground">
                      {w.endsOn ? (w.done ? `since ${formatDate(w.endsOn)}` : `ends ${formatDate(w.endsOn)}`) : "start date needed"}
                    </p>
                  </div>
                </div>
                {w.progress != null && !w.done ? (
                  <div className="ml-8 h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
                    <div className="h-full rounded-full bg-warning" style={{ width: `${Math.round(w.progress * 100)}%` }} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Family cards (on wide screens they sit in the side panel instead) */}
      <section aria-labelledby="family" className="flex flex-col gap-2.5 lg:hidden">
        <h2 id="family" className="text-heading px-1">
          Hospital-ready cards
        </h2>
        <p className="-mt-1 px-1 text-support text-muted-foreground">Show it at the hospital's insurance desk, or send it on WhatsApp.</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {covered.map((m) => {
            const copay = coPayFor(policy.numbers, m, coverStart(policy));
            return (
              <li key={m.id}>
                <Link
                  href={`/app/card?member=${m.id}`}
                  className="surface-card flex items-center gap-3 p-3.5 transition-colors hover:border-border-strong"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft font-semibold text-accent-soft-foreground">
                    {m.name.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{m.name}</span>
                    <span className="block text-[0.8rem] text-muted-foreground">
                      {RELATION_LABEL[m.relation]} · {m.age} yrs{copay ? ` · ${copay}% co-pay` : ""}
                    </span>
                  </span>
                  <IdentificationCard className="size-5 text-accent" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild variant="secondary" block>
          <Link href="/app/add">
            <Plus aria-hidden /> Add another policy
          </Link>
        </Button>
        <Button asChild variant="soft" block>
          <Link href="/app/ask">
            Ask anything about it <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}
