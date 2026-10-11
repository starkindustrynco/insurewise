import { CheckCircle, Clock, Phone, WarningCircle } from "@phosphor-icons/react";
import { LogoMark } from "@/components/brand/logo";
import type { CardData } from "@/domain/card";
import { formatDate } from "@/domain/policy/waiting";
import { RELATION_LABEL } from "@/features/onboarding/step-family";
import type { Relation } from "@/domain/types";
import { cn } from "@/lib/utils/cn";

/** The hospital-ready card itself. Used by the family and by the hospital desk view. */
export function CardView({ card, className, compact = false }: { card: CardData; className?: string; compact?: boolean }) {
  const rows: { label: string; value: string; tone?: "warn" | "ok" }[] = [
    { label: "Room", value: card.room, tone: /up to|depends|not found/i.test(card.room) ? "warn" : "ok" },
    { label: "Co-payment", value: card.coPay ? `${card.coPay}% of each claim` : "None for this member", tone: card.coPay ? "warn" : "ok" },
    {
      label: "Gloves, masks, kits",
      value: card.consumables === "covered" ? "Covered" : card.consumables === "not-covered" ? "Not covered: patient pays" : "Not found in documents",
      tone: card.consumables === "covered" ? "ok" : "warn",
    },
  ];
  return (
    <article
      className={cn("overflow-hidden rounded-3xl border border-border bg-surface shadow-raised", className)}
      aria-label={`Hospital-ready card for ${card.name}`}
    >
      <header className={cn("flex items-start justify-between gap-3 bg-primary px-5 text-primary-foreground", compact ? "py-3" : "py-4")}>
        <div className="min-w-0">
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.12em] opacity-75">Hospital-ready card</p>
          <h2 className="mt-1 truncate text-[1.35rem] font-semibold leading-tight">{card.name}</h2>
          <p className="text-[0.85rem] opacity-80">
            {RELATION_LABEL[card.relation as Relation] ?? "Family"} · {card.age} yrs
          </p>
        </div>
        <LogoMark className="size-9 shrink-0" />
      </header>
      <div className={cn("flex flex-col px-5", compact ? "gap-3 py-3.5" : "gap-4 py-4")}>
        <div>
          <p className="font-semibold leading-snug">{card.product ?? "Health policy"}</p>
          <p className="text-support text-muted-foreground">{card.insurer ?? "Insurer not found in documents"}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-support">
            <dt className="text-muted-foreground">Policy no.</dt>
            <dd className="font-medium tabular">{card.policyNo ?? "Not found"}</dd>
            <dt className="text-muted-foreground">Sum insured</dt>
            <dd className="font-medium">{card.sumInsured ?? "Not found"}</dd>
            {card.validTill ? (
              <>
                <dt className="text-muted-foreground">Valid till</dt>
                <dd className="font-medium">{formatDate(card.validTill)}</dd>
              </>
            ) : null}
          </dl>
        </div>

        {card.tpa || card.helpline ? (
          <p className="flex items-center gap-2 rounded-xl bg-accent-soft px-3 py-2 text-support text-accent-soft-foreground">
            <Phone className="size-4 shrink-0" weight="fill" aria-hidden />
            <span>
              {card.tpa ?? "Claims helpline"}
              {card.helpline ? ` · ${card.helpline}` : ""}
            </span>
          </p>
        ) : null}

        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {rows.map((r) => (
            <li key={r.label} className={cn("flex items-center gap-3 px-3", compact ? "py-2" : "py-2.5")}>
              {r.tone === "ok" ? (
                <CheckCircle className="size-5 shrink-0 text-success" weight="fill" aria-hidden />
              ) : (
                <WarningCircle className="size-5 shrink-0 text-warning-foreground" weight="fill" aria-hidden />
              )}
              <span className="w-28 shrink-0 text-support text-muted-foreground">{r.label}</span>
              <span className="min-w-0 text-[0.9rem] font-medium">{r.value}</span>
            </li>
          ))}
        </ul>

        {card.waiting.length ? (
          <div className="rounded-xl bg-warning-soft/70 p-3">
            <p className="flex items-center gap-2 text-support font-medium text-warning-foreground">
              <Clock className="size-4" weight="fill" aria-hidden /> Still in waiting period
            </p>
            <ul className="mt-1.5 flex flex-col gap-1 text-support">
              {card.waiting.map((w) => (
                <li key={w.title} className="flex justify-between gap-3">
                  <span>{w.title}</span>
                  <span className="shrink-0 text-muted-foreground">{w.ends ? `till ${formatDate(w.ends)}` : "date unknown"}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-support text-success-foreground">
            <CheckCircle className="size-4" weight="fill" aria-hidden /> No waiting periods running
          </p>
        )}
      </div>
    </article>
  );
}
