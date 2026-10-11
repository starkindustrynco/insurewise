"use client";

import Link from "next/link";
import { useState } from "react";
import { Briefcase, CaretDown, Lightbulb } from "@phosphor-icons/react";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { ScoreRing, LABEL_TONE } from "@/components/verdict/score-ring";
import { Checklist } from "@/components/verdict/checklist";
import { CHECK_BY_ID, labelFor, verdictFor, type ScoreLabel, formatLakh } from "@/domain/policy/framework";
import { useApp } from "@/store/app-store";
import { useHydrated } from "@/hooks/use-hydrated";
import type { Policy } from "@/domain/types";

interface Client {
  id: string;
  name: string;
  city: string;
  policy: string;
  score: number;
  redFlags: string[];
  idea: string;
  policyRecord?: Policy;
}

const SAMPLE_CLIENTS: Client[] = [
  {
    id: "c1",
    name: "Sahil Kapoor",
    city: "Pune",
    policy: "Kestrel Optima (Sample) · ₹15 lakh",
    score: 88,
    redFlags: [],
    idea: "Strong base cover. Nothing urgent; review the cover amount in 2 years.",
  },
  {
    id: "c2",
    name: "Joseph Mathew",
    city: "Kochi",
    policy: "Employer group cover (Sample) · ₹3 lakh",
    score: 52,
    redFlags: ["room-rent"],
    idea: "Cover ends if he changes jobs. Talk about a personal base policy plus a super top-up.",
  },
  {
    id: "c3",
    name: "Priyanka Bhatt",
    city: "Ahmedabad",
    policy: "Silver Years (Sample) for parents · ₹5 lakh",
    score: 38,
    redFlags: ["co-payment", "room-rent"],
    idea: "20% co-payment and a room cap for her parents. Check plans without co-pay at renewal.",
  },
];

function Row({ c }: { c: Client }) {
  const [open, setOpen] = useState(false);
  const label: ScoreLabel = labelFor(c.score);
  return (
    <li className="surface-card overflow-hidden">
      <button className="flex w-full items-center gap-4 p-4 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <ScoreRing score={c.score} label={label} size={64} />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{c.name}</span>
          <span className="block truncate text-support text-muted-foreground">
            {c.policy} · {c.city}
          </span>
          <span className="mt-1 flex flex-wrap gap-1">
            <Badge tone={LABEL_TONE[label]}>{label}</Badge>
            {c.redFlags.map((f) => (
              <Badge key={f} tone="danger">
                {CHECK_BY_ID[f as keyof typeof CHECK_BY_ID]?.term ?? f}
              </Badge>
            ))}
          </span>
        </span>
        <CaretDown className={`size-4 shrink-0 text-faint-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open ? (
        <div className="flex flex-col gap-4 border-t border-border p-4">
          <p className="flex items-start gap-2 rounded-xl bg-accent-soft/60 p-3 text-[0.9rem]">
            <Lightbulb className="mt-0.5 size-5 shrink-0 text-accent" weight="fill" aria-hidden /> {c.idea}
          </p>
          {c.policyRecord ? <Checklist checks={c.policyRecord.checks} refs={c.policyRecord.pageRefs} groups={["must"]} /> : null}
        </div>
      ) : null}
    </li>
  );
}

/** Mock advisor view: clients' policy scores and red flags at a glance. */
export function AdvisorDesk() {
  const hydrated = useHydrated();
  const members = useApp((s) => s.members);
  const policies = useApp((s) => s.policies);
  const me = members.find((m) => m.relation === "self");
  const mine: Client[] =
    hydrated && me
      ? policies.map((p) => {
          const v = verdictFor(p.checks);
          return {
            id: p.id,
            name: me.name,
            city: (() => {
              const si = p.facts.sumInsuredInr ?? p.answers.sumInsuredInr;
              return si ? `${formatLakh(si)} · Shared from InsureWise` : "Shared from InsureWise";
            })(),
            policy: p.label,
            score: v.score,
            redFlags: v.redFlags.map((r) => r.id),
            idea: v.redFlags.length
              ? `Talk about ${v.redFlags.map((r) => CHECK_BY_ID[r.id].term.toLowerCase()).join(" and ")} at renewal.`
              : "No red flags. Check the cover amount and waiting periods together.",
            policyRecord: p,
          };
        })
      : [];

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" aria-label="InsureWise home">
            <Logo />
          </Link>
          <span className="inline-flex items-center gap-1.5 text-support text-muted-foreground">
            <Briefcase className="size-4" aria-hidden /> Advisor view (demo)
          </span>
        </div>
      </header>
      <main id="main" className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
        <div>
          <h1 className="text-title">Your clients</h1>
          <p className="text-muted-foreground">Policy scores and red flags from the same checklist families see. Clients choose what to share.</p>
        </div>
        <ul className="flex flex-col gap-3">
          {[...mine, ...SAMPLE_CLIENTS].map((c) => (
            <Row key={c.id} c={c} />
          ))}
        </ul>
        <p className="text-[0.8rem] text-muted-foreground">Demo only. Sample clients are fictional; sharing isn't enforced.</p>
      </main>
    </div>
  );
}
