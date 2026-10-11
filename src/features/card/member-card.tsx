"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowSquareOut, CheckSquare, Copy, WhatsappLogo } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { QrCode } from "@/components/qr-code";
import { CASHLESS_STEPS, DOCS_TO_CARRY, cardFor, cardText, encodeCard } from "@/domain/card";
import { activePolicy, useApp } from "@/store/app-store";
import { CardView } from "./card-view";

export function MemberCard() {
  const params = useSearchParams();
  const members = useApp((s) => s.members);
  const policy = useApp((s) => activePolicy(s));
  const member = members.find((m) => m.id === params.get("member")) ?? members[0];
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const card = useMemo(() => (policy && member ? cardFor(policy, member) : null), [policy, member]);
  if (!policy || !member || !card) return <p className="py-16 text-center text-muted-foreground">Add a policy first.</p>;

  const link = `${origin}/hospital?c=${encodeCard(card)}`;
  const text = cardText(card, link);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Card copied");
    } catch {
      toast.error("Couldn't copy. Select the text instead.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/app">
          <ArrowLeft aria-hidden /> My cover
        </Link>
      </Button>

      {members.length > 1 ? (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none" aria-label="Family members">
          {members
            .filter((m) => policy.memberIds.includes(m.id))
            .map((m) => (
              <Link
                key={m.id}
                href={`/app/card?member=${m.id}`}
                aria-current={m.id === member.id ? "page" : undefined}
                className={
                  m.id === member.id
                    ? "h-9 shrink-0 rounded-full bg-primary px-4 py-2 text-[0.875rem] font-medium text-primary-foreground"
                    : "h-9 shrink-0 rounded-full border border-border bg-surface px-4 py-2 text-[0.875rem] font-medium text-foreground-soft"
                }
              >
                {m.name.split(" ")[0]}
              </Link>
            ))}
        </div>
      ) : null}

      <CardView card={card} />

      <section className="surface-card flex items-center gap-4 p-4" aria-label="Scan at the hospital">
        {origin ? (
          <QrCode value={link} size={132} label={`QR code with ${member.name}'s card for the hospital desk`} />
        ) : (
          <div className="size-[132px]" />
        )}
        <div className="flex flex-col gap-2">
          <p className="font-medium leading-snug">Let the desk scan this</p>
          <p className="text-support text-muted-foreground">It opens this card on their screen, with what to check before admission.</p>
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-support font-medium text-accent-strong hover:underline"
          >
            Open hospital view <ArrowSquareOut className="size-4" aria-hidden />
          </a>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="accent" size="lg">
          <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
            <WhatsappLogo weight="fill" aria-hidden /> WhatsApp
          </a>
        </Button>
        <Button variant="secondary" size="lg" onClick={() => void copy()}>
          <Copy aria-hidden /> Copy
        </Button>
      </div>

      <section aria-labelledby="carry" className="flex flex-col gap-2.5">
        <h2 id="carry" className="text-heading px-1">
          Carry these
        </h2>
        <ul className="surface-card divide-y divide-border">
          {DOCS_TO_CARRY.map((d) => (
            <li key={d} className="flex items-center gap-3 px-4 py-3 text-[0.9rem]">
              <CheckSquare className="size-5 shrink-0 text-accent" aria-hidden /> {d}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="cashless" className="flex flex-col gap-2.5">
        <h2 id="cashless" className="text-heading px-1">
          Getting cashless approval
        </h2>
        <ol className="surface-card flex flex-col gap-3 p-4">
          {CASHLESS_STEPS.map((s, i) => (
            <li key={s} className="flex gap-3 text-[0.9rem]">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[0.8rem] font-semibold text-accent-soft-foreground">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
