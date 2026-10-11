import type { Member, Policy } from "@/domain/types";
import { coPayFor, formatInr, formatLakh, roomCapPerDay, tidyName } from "@/domain/policy/framework";
import { coverStart, waitingFor } from "@/domain/policy/waiting";

/** What a hospital insurance desk needs to know about a patient's cover, in one card. */
export interface CardData {
  v: 1;
  name: string;
  age: number;
  relation: string;
  insurer: string | null;
  product: string | null;
  policyNo: string | null;
  sumInsured: string | null;
  tpa: string | null;
  helpline: string | null;
  room: string;
  coPay: number;
  consumables: "covered" | "not-covered" | "unknown";
  /** Waiting periods still running: title and end date. */
  waiting: { kind: "initial" | "specific" | "ped" | "maternity"; title: string; ends: string | null }[];
  validTill: string | null;
}

export const DOCS_TO_CARRY = [
  "This card, or the health card / e-card",
  "Patient's photo ID (Aadhaar, PAN or passport)",
  "Policy number and policyholder's ID",
  "Doctor's note advising admission",
  "Earlier reports for this illness, if any",
];

export const CASHLESS_STEPS = [
  "Show this card at the hospital's insurance (TPA) desk before admission.",
  "The desk sends a pre-authorisation request to the insurer or TPA.",
  "Keep your phone handy: the TPA may ask questions. Approval usually comes within hours.",
];

export function roomText(policy: Policy): string {
  const n = policy.numbers;
  const cap = roomCapPerDay(policy);
  if (cap) return `Room up to ${formatInr(cap)} a day`;
  if (n.roomRentBasis === "no-limit") return "Any room, no cap";
  if (n.roomCategory) return n.roomCategory;
  if (n.roomRentBasis === "tiered-by-sum-insured") return "Depends on sum insured: check with the desk";
  return "Not found in documents";
}

export function cardFor(policy: Policy, member: Member, todayIso?: string): CardData {
  const si = policy.facts.sumInsuredInr ?? policy.answers.sumInsuredInr ?? null;
  return {
    v: 1,
    name: member.name,
    age: member.age,
    relation: member.relation,
    insurer: policy.facts.insurerName ? tidyName(policy.facts.insurerName) : null,
    product: policy.facts.productName ?? policy.label,
    policyNo: policy.facts.policyNumber,
    sumInsured: si ? (policy.facts.cumulativeBonusInr ? `${formatLakh(si)} + ${formatLakh(policy.facts.cumulativeBonusInr)} bonus` : formatLakh(si)) : null,
    tpa: policy.facts.tpaName,
    helpline: policy.facts.helpline,
    room: roomText(policy),
    coPay: coPayFor(policy.numbers, member, coverStart(policy), todayIso),
    consumables: policy.numbers.consumablesCovered === true ? "covered" : policy.numbers.consumablesCovered === false ? "not-covered" : "unknown",
    waiting: waitingFor(policy, todayIso)
      .filter((w) => !w.done && w.kind !== "maternity")
      .map((w) => ({ kind: w.kind, title: w.title, ends: w.endsOn })),
    validTill: policy.facts.policyEnd,
  };
}

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeCard(c: CardData): string {
  return toBase64Url(JSON.stringify(c));
}

export function decodeCard(s: string | null | undefined): CardData | null {
  if (!s) return null;
  try {
    const c = JSON.parse(fromBase64Url(s)) as CardData;
    return c && c.v === 1 && typeof c.name === "string" ? c : null;
  } catch {
    return null;
  }
}

/** Plain-text version for WhatsApp or SMS. */
export function cardText(c: CardData, link?: string): string {
  const lines = [
    `🏥 Hospital-ready card: ${c.name} (${c.age})`,
    `${c.product ?? "Health policy"}${c.insurer ? `, ${c.insurer}` : ""}`,
    c.policyNo ? `Policy no: ${c.policyNo}` : null,
    c.sumInsured ? `Sum insured: ${c.sumInsured}` : null,
    c.tpa ? `TPA: ${c.tpa}${c.helpline ? ` (${c.helpline})` : ""}` : c.helpline ? `Helpline: ${c.helpline}` : null,
    `Room: ${c.room}`,
    c.coPay ? `Co-payment: ${c.coPay}% of each claim` : "Co-payment: none for this member",
    c.waiting.length ? `Still in waiting: ${c.waiting.map((w) => w.title.toLowerCase()).join("; ")}` : null,
    link ? `Details: ${link}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}
