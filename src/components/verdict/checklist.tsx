"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CaretDown, CheckCircle, Question, Quotes, WarningCircle, XCircle } from "@phosphor-icons/react";
import { CHECK_BY_ID, CHECKS } from "@/domain/policy/framework";
import type { CheckGroup, CheckResult, CheckStatus, PageRef } from "@/domain/types";
import { cn } from "@/lib/utils/cn";

export const STATUS_META: Record<CheckStatus, { label: string; icon: typeof CheckCircle; text: string; bg: string }> = {
  meets: { label: "Yes", icon: CheckCircle, text: "text-success", bg: "bg-success-soft" },
  partial: { label: "Partly", icon: WarningCircle, text: "text-warning-foreground", bg: "bg-warning-soft" },
  "does-not-meet": { label: "No", icon: XCircle, text: "text-danger", bg: "bg-danger-soft" },
  "not-found": { label: "Not found", icon: Question, text: "text-muted-foreground", bg: "bg-neutral-soft" },
};

export function StatusIcon({ status, className }: { status: CheckStatus; className?: string }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return <Icon weight="fill" className={cn("size-6 shrink-0", m.text, className)} aria-label={m.label} role="img" />;
}

const GROUP_TITLE: Record<CheckGroup, { title: string; note: string }> = {
  must: { title: "Must-haves", note: "The seven things every family policy should have" },
  good: { title: "Good to have", note: "Nice extras, not deal-breakers" },
  cover: { title: "Cover amount", note: "Is the sum insured enough?" },
};

export function pageLabel(page: number | null, refs?: PageRef[]): string | null {
  if (!page) return null;
  const ref = refs?.[page - 1];
  if (!ref) return `Page ${page}`;
  const multiFile = refs ? new Set(refs.map((r) => r.file)).size > 1 : false;
  return multiFile ? `${ref.file.replace(/\.[a-z0-9]+$/i, "")}, page ${ref.page}` : `Page ${ref.page}`;
}

function Row({ check, refs, onAsk }: { check: CheckResult; refs?: PageRef[]; onAsk?: (q: string) => void }) {
  const [open, setOpen] = useState(false);
  const def = CHECK_BY_ID[check.id];
  const page = pageLabel(check.page, refs);
  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <StatusIcon status={check.status} />
        <span className="min-w-0 flex-1">
          <span className="block font-medium leading-snug">{def.title}</span>
          <span className="block truncate text-support text-muted-foreground">{check.value || STATUS_META[check.status].label}</span>
        </span>
        <CaretDown className={cn("size-4 shrink-0 text-faint-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 px-4 pb-4 pl-[3.25rem] text-support">
              {check.explanation ? <p className="text-foreground-soft">{check.explanation}</p> : null}
              {check.quote ? (
                <figure className="rounded-xl border border-border bg-surface-muted/70 p-3">
                  <Quotes className="mb-1 size-4 text-faint-foreground" weight="fill" aria-hidden />
                  <blockquote className="italic leading-relaxed text-foreground-soft">{check.quote}</blockquote>
                  <figcaption className="mt-2 flex flex-wrap items-center gap-x-2 text-[0.75rem] text-muted-foreground">
                    {page ? <span className="font-medium text-foreground-soft">{page}</span> : null}
                    <span>{check.verified ? "· Found in your document" : "· Couldn't find this exact wording, check the page"}</span>
                  </figcaption>
                </figure>
              ) : check.source === "you" ? (
                <p className="text-muted-foreground">Based on what you told us.</p>
              ) : null}
              <dl className="grid gap-1 rounded-xl bg-accent-soft/50 p-3">
                <dt className="text-[0.75rem] font-medium text-accent-soft-foreground">{def.term}: what it means</dt>
                <dd className="text-foreground-soft">{def.meaning}</dd>
                <dd className="text-[0.75rem] text-muted-foreground">What good looks like: {def.good}</dd>
              </dl>
              {onAsk ? (
                <button
                  type="button"
                  onClick={() => onAsk(`Explain ${def.term.toLowerCase()} in my policy simply.`)}
                  className="self-start text-[0.8125rem] font-medium text-accent-strong hover:underline"
                >
                  Ask about this
                </button>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}

export function Checklist({
  checks,
  refs,
  onAsk,
  groups = ["must", "good", "cover"],
}: {
  checks: CheckResult[];
  refs?: PageRef[];
  onAsk?: (q: string) => void;
  groups?: CheckGroup[];
}) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => {
        const items = CHECKS.filter((d) => d.group === g)
          .map((d) => checks.find((c) => c.id === d.id))
          .filter((c): c is CheckResult => Boolean(c));
        if (!items.length) return null;
        const met = items.filter((c) => c.status === "meets").length;
        return (
          <section key={g} aria-labelledby={`grp-${g}`}>
            <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
              <h3 id={`grp-${g}`} className="text-heading">
                {GROUP_TITLE[g].title}
              </h3>
              {g !== "cover" ? (
                <span className="tabular text-support text-muted-foreground">
                  {met} of {items.length}
                </span>
              ) : null}
            </div>
            <ul className="surface-card overflow-hidden">
              {items.map((c) => (
                <Row key={c.id} check={c} refs={refs} onAsk={onAsk} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
