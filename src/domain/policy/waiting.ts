import type { Policy } from "@/domain/types";

export type WaitKind = "initial" | "specific" | "ped" | "maternity";

export interface WaitingItem {
  kind: WaitKind;
  title: string;
  detail: string;
  /** Length as the policy states it. */
  length: string;
  /** ISO date the waiting period ends, when the start date is known. */
  endsOn: string | null;
  done: boolean;
  daysLeft: number | null;
  /** 0–1 share of the waiting period already served. */
  progress: number | null;
}

/** The date cover started for waiting purposes: first inception, else this policy's start, else the user's answer. */
export function coverStart(p: Policy): string | null {
  return p.facts.firstInception ?? p.answers.firstInception ?? p.facts.policyStart ?? null;
}

function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const DAY = 86_400_000;

/** Waiting periods for a policy, with countdowns when the start date is known. */
export function waitingFor(p: Policy, todayIso: string = new Date().toISOString().slice(0, 10)): WaitingItem[] {
  const n = p.numbers;
  const start = coverStart(p);
  const today = Date.parse(`${todayIso}T00:00:00Z`);
  const items: WaitingItem[] = [];

  const push = (kind: WaitKind, title: string, detail: string, length: string, endsOn: string | null) => {
    if (!endsOn || !start) {
      items.push({ kind, title, detail, length, endsOn: null, done: false, daysLeft: null, progress: null });
      return;
    }
    const s = Date.parse(`${start}T00:00:00Z`);
    const e = Date.parse(`${endsOn}T00:00:00Z`);
    const done = today >= e;
    items.push({
      kind,
      title,
      detail,
      length,
      endsOn,
      done,
      daysLeft: done ? 0 : Math.ceil((e - today) / DAY),
      progress: e > s ? Math.min(1, Math.max(0, (today - s) / (e - s))) : 1,
    });
  };

  if (n.initialWaitingDays != null)
    push(
      "initial",
      "Any new illness",
      "Accidents are covered from day one.",
      `${n.initialWaitingDays} days`,
      start ? addDays(start, n.initialWaitingDays) : null,
    );
  if (n.specificIllnessMonths != null)
    push(
      "specific",
      "Listed illnesses and surgeries",
      n.specificIllnesses.length
        ? n.specificIllnesses.slice(0, 6).join(", ") + (n.specificIllnesses.length > 6 ? " and more" : "")
        : "Conditions named in the policy's list",
      `${n.specificIllnessMonths} months`,
      start ? addMonths(start, n.specificIllnessMonths) : null,
    );
  if (n.pedMonths != null)
    push(
      "ped",
      "Illnesses you had before buying",
      "Like diabetes, BP or thyroid, if anyone had them when the policy started.",
      `${n.pedMonths} months`,
      start ? addMonths(start, n.pedMonths) : null,
    );
  if (n.maternityCovered && n.maternityMonths != null)
    push(
      "maternity",
      "Pregnancy and delivery",
      "If the policy covers maternity for your family.",
      `${n.maternityMonths} months`,
      start ? addMonths(start, n.maternityMonths) : null,
    );
  return items;
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
