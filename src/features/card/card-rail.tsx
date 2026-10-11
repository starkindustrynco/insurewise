"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ArrowSquareOut, Copy, IdentificationCard, WhatsappLogo } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { QrCode } from "@/components/qr-code";
import { cardFor } from "@/domain/card";
import { activePolicy, useApp } from "@/store/app-store";
import { cn } from "@/lib/utils/cn";
import { CardView } from "./card-view";
import { useCardShare } from "./use-card-share";

/**
 * Hospital-ready cards in a side panel, so they're one glance away on any
 * screen of the app on a laptop or desktop.
 */
export function CardRail() {
  const members = useApp((s) => s.members);
  const policy = useApp((s) => activePolicy(s));
  const covered = useMemo(() => (policy ? members.filter((m) => policy.memberIds.includes(m.id)) : []), [members, policy]);
  const [picked, setPicked] = useState<string | null>(null);
  const member = covered.find((m) => m.id === picked) ?? covered[0];
  const card = useMemo(() => (policy && member ? cardFor(policy, member) : null), [policy, member]);
  const { link, copy, whatsapp } = useCardShare(card);

  if (!policy || !member || !card)
    return (
      <section aria-labelledby="rail-title" className="surface-card flex flex-col items-start gap-3 p-5">
        <IdentificationCard className="size-7 text-accent" aria-hidden />
        <h2 id="rail-title" className="font-semibold">
          Hospital-ready cards
        </h2>
        <p className="text-support text-muted-foreground">Add a policy and pick who it covers to get a card for each person.</p>
        <Button asChild variant="secondary" size="sm">
          <Link href="/app/add">Add a policy</Link>
        </Button>
      </section>
    );

  return (
    <section aria-labelledby="rail-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5 px-1">
        <h2 id="rail-title" className="text-heading">
          Hospital-ready cards
        </h2>
        <p className="text-support text-muted-foreground">Show it at the insurance desk, or send it ahead.</p>
      </div>

      {covered.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Whose card">
          {covered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setPicked(m.id)}
              aria-pressed={m.id === member.id}
              className={cn(
                "h-8 rounded-full px-3.5 text-[0.85rem] font-medium transition-colors",
                m.id === member.id
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-surface text-foreground-soft hover:border-border-strong",
              )}
            >
              {m.name.split(" ")[0]}
            </button>
          ))}
        </div>
      ) : null}

      <CardView card={card} compact />

      <div className="surface-card flex items-center gap-3 p-3">
        {link ? (
          <QrCode value={link} size={92} label={`QR code with ${member.name}'s card for the hospital desk`} />
        ) : (
          <div className="size-[92px] shrink-0" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-[0.85rem] font-medium leading-snug">The desk can scan this to open the card</p>
          <div className="flex gap-1.5">
            <Button asChild variant="accent" size="sm" className="flex-1">
              <a href={whatsapp} target="_blank" rel="noreferrer">
                <WhatsappLogo weight="fill" aria-hidden /> WhatsApp
              </a>
            </Button>
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => void copy()}>
              <Copy aria-hidden /> Copy
            </Button>
          </div>
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[0.8rem] font-medium text-accent-strong hover:underline"
            >
              Open hospital view <ArrowSquareOut className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>

      <Link
        href={`/app/card?member=${member.id}`}
        className="inline-flex items-center gap-1 px-1 text-[0.85rem] font-medium text-accent-strong hover:underline"
      >
        Papers to carry and cashless steps <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}
