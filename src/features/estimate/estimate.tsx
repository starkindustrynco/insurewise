"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Info, Medal, Prohibit, WarningCircle } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { ROOMS, TREATMENTS, bestOf, estimateFor, type RoomId } from "@/domain/estimate";
import { formatInr } from "@/domain/policy/framework";
import { useApp } from "@/store/app-store";
import { cn } from "@/lib/utils/cn";

const range = (a: number, b: number) => (Math.abs(a - b) < 500 ? formatInr(a) : `${formatInr(a)} – ${formatInr(b)}`);

export function Estimate() {
  const members = useApp((s) => s.members);
  const policies = useApp((s) => s.policies);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [treatmentId, setTreatmentId] = useState(TREATMENTS[0].id);
  const [room, setRoom] = useState<RoomId>("single");
  const [bill, setBill] = useState("");

  // Start with someone a policy actually covers.
  const member =
    members.find((m) => m.id === memberId) ?? members.find((m) => policies.some((p) => p.memberIds.includes(m.id))) ?? members[0];
  const treatment = TREATMENTS.find((t) => t.id === treatmentId)!;
  const own = policies.filter((p) => member && p.memberIds.includes(member.id));
  const roomPerDay = ROOMS.find((r) => r.id === room)!.perDay;
  const billNum = bill ? Number(bill) : null;

  const results = useMemo(
    () => (member ? own.map((p) => estimateFor(p, member, treatment, { roomPerDay, bill: billNum && billNum > 0 ? billNum : null })) : []),
    [own, member, treatment, roomPerDay, billNum],
  );
  const best = bestOf(results);

  if (!member) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-title">What will I pay?</h1>
        <p className="text-support text-muted-foreground">Pick a treatment to see your share under each policy you own.</p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-medium">For</span>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none">
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => setMemberId(m.id)}
              aria-pressed={m.id === member.id}
              className={cn(
                "h-9 shrink-0 rounded-full border px-4 text-[0.875rem] font-medium",
                m.id === member.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground-soft",
              )}
            >
              {m.name.split(" ")[0]} · {m.age}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="treatment" className="font-medium">
          Treatment
        </Label>
        <select
          id="treatment"
          value={treatmentId}
          onChange={(e) => setTreatmentId(e.target.value)}
          className="h-11 rounded-[0.625rem] border border-border bg-surface px-3 text-[0.95rem]"
        >
          {TREATMENTS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="text-[0.8rem] text-muted-foreground">
          Typical cost in a big-city private hospital: {range(treatment.low, treatment.high)}
          {treatment.days ? `, about ${treatment.days} days` : ", day care"}.
        </p>
      </div>

      {treatment.days ? (
        <div className="flex flex-col gap-2">
          <span className="font-medium">Room</span>
          <Segmented<RoomId>
            label="Room type"
            value={room}
            onValueChange={setRoom}
            options={ROOMS.map((r) => ({ value: r.id, label: r.label }))}
            wrap
          />
          <p className="text-[0.8rem] text-muted-foreground">Assumed {formatInr(roomPerDay)} a day.</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bill">Hospital's estimate (optional)</Label>
        <Input
          id="bill"
          inputMode="numeric"
          placeholder="e.g. 350000"
          value={bill}
          onChange={(e) => setBill(e.target.value.replace(/\D/g, "").slice(0, 8))}
          className="max-w-56"
        />
      </div>

      {own.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border-strong px-4 py-6 text-center text-muted-foreground">
          None of your policies covers {member.name.split(" ")[0]} yet.{" "}
          <Link href="/app/add" className="font-medium text-accent-strong hover:underline">
            Add their policy
          </Link>
        </p>
      ) : (
        <section aria-label="Your share" className="flex flex-col gap-3">
          {results.map((r) => (
            <article
              key={r.policyId}
              className={cn("surface-card flex flex-col gap-4 p-4", best?.policyId === r.policyId && results.length > 1 && "ring-2 ring-accent")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.label}</p>
                  {best?.policyId === r.policyId && results.length > 1 ? (
                    <Badge tone="accent" className="mt-1">
                      <Medal weight="fill" aria-hidden /> Best one to use
                    </Badge>
                  ) : null}
                </div>
              </div>
              {r.blocked ? (
                <p className="flex items-start gap-2 rounded-xl bg-danger-soft/70 p-3 text-[0.9rem]">
                  <Prohibit className="mt-0.5 size-5 shrink-0 text-danger" weight="fill" aria-hidden /> {r.blocked}
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-surface-muted p-3">
                      <p className="text-[0.8rem] text-muted-foreground">You may pay</p>
                      <p className="tabular text-[1.35rem] font-semibold leading-tight">{range(r.low, r.high)}</p>
                    </div>
                    <div className="rounded-xl bg-success-soft/60 p-3">
                      <p className="text-[0.8rem] text-muted-foreground">Policy may pay</p>
                      <p className="tabular text-[1.35rem] font-semibold leading-tight text-success-foreground">{range(r.paysLow, r.paysHigh)}</p>
                    </div>
                  </div>
                  {r.lines.length ? (
                    <ul className="flex flex-col gap-2.5">
                      {r.lines.map((l) => (
                        <li key={l.label} className="flex items-start justify-between gap-3 text-[0.9rem]">
                          <span className="min-w-0">
                            <span className="block font-medium">{l.label}</span>
                            <span className="block text-[0.8rem] text-muted-foreground">{l.note}</span>
                          </span>
                          <span className="tabular shrink-0 font-medium">{range(l.low, l.high)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-support text-success-foreground">Nothing in your policy reduces this claim.</p>
                  )}
                </>
              )}
              {r.warnings.map((w) => (
                <p key={w} className="flex items-start gap-2 text-[0.85rem] text-warning-foreground">
                  <WarningCircle className="mt-0.5 size-4 shrink-0" weight="fill" aria-hidden /> {w}
                </p>
              ))}
            </article>
          ))}
          {results.length > 1 ? (
            <p className="flex items-start gap-2 text-[0.85rem] text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> If one policy's cover runs out, you can usually claim the rest from your other
              policy.
            </p>
          ) : null}
        </section>
      )}

      <p className="text-[0.78rem] text-muted-foreground">
        Illustrative. Typical costs are rough ranges, and the policy's rules are applied as your documents state them. Only your insurer decides what
        is paid.
      </p>
    </div>
  );
}
