"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CheckCircle, CircleNotch, Hospital, PaperPlaneTilt, WarningCircle } from "@phosphor-icons/react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DOCS_TO_CARRY, decodeCard, encodeCard, type CardData } from "@/domain/card";
import { formatDate } from "@/domain/policy/waiting";
import { CardView } from "@/features/card/card-view";

const SAMPLE_PATIENTS: CardData[] = [
  {
    v: 1,
    name: "Sahil Kapoor",
    age: 46,
    relation: "self",
    insurer: "Kestrel Health (Sample)",
    product: "Kestrel Optima (Sample)",
    policyNo: "KH/OPT/2025/118204",
    sumInsured: "₹15 lakh",
    tpa: "Harbour Health TPA (Sample)",
    helpline: "1800 000 1234",
    room: "Any room, no cap",
    coPay: 0,
    consumables: "covered",
    waiting: [],
    validTill: "2027-02-28",
  },
  {
    v: 1,
    name: "Lakshmi Narayanan",
    age: 64,
    relation: "parent",
    insurer: "Lotus Health Insurance (Sample)",
    product: "Silver Years (Sample)",
    policyNo: "LHS/SY/2026/0091",
    sumInsured: "₹5 lakh",
    tpa: "Harbour Health TPA (Sample)",
    helpline: null,
    room: "Room up to ₹5,000 a day",
    coPay: 20,
    consumables: "not-covered",
    waiting: [{ kind: "specific", title: "Listed illnesses and surgeries", ends: "2027-06-01" }],
    validTill: "2027-05-31",
  },
];

function checksFor(c: CardData): string[] {
  const out: string[] = [];
  if (/up to/i.test(c.room))
    out.push(`Offer a room within the limit (${c.room.toLowerCase()}), or explain that a costlier room reduces other charges too.`);
  if (c.coPay) out.push(`Tell the family they pay ${c.coPay}% of the approved amount (co-payment).`);
  if (c.consumables === "not-covered") out.push("Consumables (gloves, masks, kits) are not covered: collect them from the patient.");
  for (const w of c.waiting) {
    const till = w.ends ? ` till ${formatDate(w.ends)}` : "";
    if (w.kind === "ped")
      out.push(`Conditions the patient had before the policy began are in a waiting period${till}. Note the history in the pre-authorisation form.`);
    else if (w.kind === "initial") out.push(`New illnesses are in the first waiting period${till}. Accidents are covered.`);
    else out.push(`Listed illnesses and surgeries are in a waiting period${till}. Check the planned procedure against the policy list.`);
  }
  if (!out.length) out.push("No limits flagged on the card. Proceed with the usual pre-authorisation.");
  return out;
}

/** Mock hospital insurance desk: opens a family's hospital-ready card from its QR code or link. */
export function HospitalDesk() {
  const params = useSearchParams();
  const fromLink = decodeCard(params.get("c"));
  const [card, setCard] = useState<CardData | null>(fromLink);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [stage, setStage] = useState<0 | 1 | 2 | 3>(0);

  const start = () => {
    setStage(1);
    setTimeout(() => setStage(2), 900);
    setTimeout(() => setStage(3), 1900);
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" aria-label="InsureWise home">
            <Logo />
          </Link>
          <span className="inline-flex items-center gap-1.5 text-support text-muted-foreground">
            <Hospital className="size-4" aria-hidden /> <span className="hidden sm:inline">Vriksha Hospital ·</span> Insurance desk (demo)
          </span>
        </div>
      </header>
      <main id="main" className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
        {card ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-title">Patient's cover</h1>
              <Button variant="ghost" size="sm" onClick={() => (setCard(null), setStage(0))}>
                Another patient
              </Button>
            </div>
            <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
              <CardView card={card} />
              <div className="flex flex-col gap-4">
                <section className="surface-card flex flex-col gap-3 p-4" aria-labelledby="check">
                  <h2 id="check" className="text-heading">
                    Before admission, check
                  </h2>
                  <ul className="flex flex-col gap-2.5 text-[0.9rem]">
                    {checksFor(card).map((t) => (
                      <li key={t} className="flex gap-2.5">
                        <WarningCircle className="mt-0.5 size-5 shrink-0 text-warning-foreground" weight="fill" aria-hidden />
                        {t}
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="surface-card flex flex-col gap-3 p-4" aria-labelledby="docs">
                  <h2 id="docs" className="text-heading">
                    Collect for pre-authorisation
                  </h2>
                  <ul className="flex flex-col gap-1.5 text-[0.9rem]">
                    {DOCS_TO_CARRY.slice(1).map((d) => (
                      <li key={d} className="flex gap-2">
                        <CheckCircle className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /> {d}
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="surface-card flex flex-col gap-3 p-4" aria-live="polite">
                  {stage === 0 ? (
                    <Button size="lg" onClick={start}>
                      <PaperPlaneTilt aria-hidden /> Start cashless request
                    </Button>
                  ) : (
                    <ol className="flex flex-col gap-2 text-[0.9rem]">
                      {[
                        "Pre-authorisation form filled from the card",
                        `Sent to ${card.tpa ?? "the insurer"} (simulated)`,
                        "Waiting for the TPA's reply",
                      ].map((s, i) => (
                        <li key={s} className="flex items-center gap-2.5">
                          {i < 2 && stage >= i + 2 ? (
                            <CheckCircle className="size-5 text-success" weight="fill" aria-hidden />
                          ) : stage === i + 1 ? (
                            <CircleNotch className="size-5 animate-spin text-accent" aria-hidden />
                          ) : (
                            <span className="size-5 rounded-full border-2 border-border" aria-hidden />
                          )}
                          {s}
                        </li>
                      ))}
                    </ol>
                  )}
                  <p className="text-[0.8rem] text-muted-foreground">Demo only: nothing is sent to an insurer or TPA.</p>
                </section>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <h1 className="text-title">Insurance desk</h1>
              <p className="text-muted-foreground">Scan the QR on a patient's InsureWise card, or paste the link they shared.</p>
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const raw = code.includes("c=") ? new URL(code, "http://x").searchParams.get("c") : code.trim();
                const c = decodeCard(raw);
                setCodeError(!c);
                if (c) setCard(c);
              }}
            >
              <Input
                aria-label="Card link or code"
                placeholder="Paste the card link"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                aria-invalid={codeError}
              />
              <Button type="submit">Open</Button>
            </form>
            {codeError ? <p className="text-support text-danger-foreground">That link doesn't contain a card.</p> : null}
            <section aria-labelledby="today" className="flex flex-col gap-2.5">
              <h2 id="today" className="text-heading">
                Today's admissions (sample)
              </h2>
              <ul className="surface-card divide-y divide-border">
                {SAMPLE_PATIENTS.map((p) => (
                  <li key={p.name}>
                    <Link
                      href={`/hospital?c=${encodeCard(p)}`}
                      onClick={() => setCard(p)}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-muted"
                    >
                      <span>
                        <span className="block font-medium">{p.name}</span>
                        <span className="block text-support text-muted-foreground">{p.product}</span>
                      </span>
                      <span className="text-support font-medium text-accent-strong">Open card</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
