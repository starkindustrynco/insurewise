import { CHECK_BY_ID, CHECKS, coPayFor, formatLakh, roomCapPerDay, verdictFor } from "@/domain/policy/framework";
import { normaliseForMatch } from "@/domain/ai/grounding";
import { coverStart, waitingFor, formatDate } from "@/domain/policy/waiting";
import type { CheckId, Member, Policy } from "@/domain/types";

/**
 * Picks the policy pages most likely to answer a question, so the assistant
 * sees the actual wording without sending the whole document every time.
 */

const SYNONYMS: Record<string, string[]> = {
  pregnancy: ["maternity", "delivery", "childbirth", "newborn", "caesarean"],
  pregnant: ["maternity", "delivery"],
  baby: ["maternity", "newborn"],
  delivery: ["maternity", "childbirth"],
  knee: ["joint", "replacement", "arthroplasty"],
  hip: ["joint", "replacement"],
  eye: ["cataract"],
  cataract: ["cataract", "lens"],
  heart: ["cardiac", "angioplasty", "bypass"],
  room: ["room", "rent", "accommodation", "boarding"],
  copay: ["co-payment", "copayment"],
  "co-pay": ["co-payment"],
  share: ["co-payment"],
  bp: ["pre-existing", "hypertension"],
  diabetes: ["pre-existing", "diabetes"],
  existing: ["pre-existing", "waiting"],
  waiting: ["waiting", "period"],
  ayurveda: ["ayush", "ayurveda"],
  consumables: ["consumables", "non-medical", "non-payable"],
  gloves: ["consumables", "non-payable"],
  ambulance: ["ambulance"],
  claim: ["claim", "intimation", "documents", "reimbursement", "cashless"],
  cashless: ["cashless", "network", "pre-authorisation", "pre-authorization"],
  documents: ["documents", "claim"],
  dental: ["dental"],
  mental: ["mental", "psychiatric"],
  opd: ["out-patient", "opd", "consultation"],
  cancer: ["cancer", "chemotherapy", "radiotherapy"],
  dialysis: ["dialysis"],
  surgery: ["surgery", "surgical", "operation"],
};

/**
 * Common words in Hindi, Tamil, Telugu and Kannada (and Hinglish) mapped to the
 * English terms policy documents use, so questions asked in those languages
 * still find the right pages.
 */
const INDIC: [RegExp, string[]][] = [
  [/शुगर|मधुमेह|डायबिटीज|சர்க்கரை|நீரிழிவு|షుగర్|మధుమేహ|ಸಕ್ಕರೆ|ಮಧುಮೇಹ|ಶುಗರ್|\bsugar\b|\bshugar\b/, ["diabetes", "pre-existing"]],
  [/बीपी|ब्लड प्रेशर|रक्तचाप|பிபி|இரத்த அழுத்த|రక్తపోటు|బీపీ|ರಕ್ತದೊತ್ತಡ|ಬಿಪಿ/, ["hypertension", "pre-existing"]],
  [/पहले से|पुरानी बीमारी|ஏற்கனவே உள்ள|ముందే ఉన్న|ಮೊದಲೇ ಇರುವ/, ["pre-existing", "waiting"]],
  [/घुटन|முழங்கால்|మోకాలి|ಮೊಣಕಾಲ/, ["joint", "replacement"]],
  [/दिल|हृदय|हार्ट|இதய|గుండె|ಹೃದಯ/, ["cardiac", "heart"]],
  [/ऑपरेशन|सर्जरी|அறுவை|ஆபரேஷன்|ఆపరేషన్|శస్త్రచికిత్స|ಶಸ್ತ್ರಚಿಕಿತ್ಸೆ|ಆಪರೇಷನ್/, ["surgery", "operation"]],
  [/कमरा|कमरे|रूम|அறை|ரூம்|గది|రూమ్|ಕೊಠಡಿ|ರೂಮ್/, ["room", "rent"]],
  [/गर्भ|प्रसव|डिलीवरी|பிரசவ|கர்ப்ப|ప్రసవ|గర్భ|ಹೆರಿಗೆ|ಗರ್ಭ/, ["maternity", "delivery"]],
  [/मोतियाबिंद|आँख|आंख|கண்புரை|கண்|కంటి|క్యాటరాక్ట్|ಕಣ್ಣ/, ["cataract"]],
  [/कैंसर|புற்றுநோய்|క్యాన్సర్|ಕ್ಯಾನ್ಸರ್/, ["cancer", "chemotherapy"]],
  [/किडनी|डायलिसिस|சிறுநீரக|டயாலிசிஸ்|కిడ్నీ|డయాలసిస్|ಕಿಡ್ನಿ|ಡಯಾಲಿಸಿಸ್/, ["dialysis", "kidney"]],
  [/क्लेम|दावा|க்ளெய்ம்|கோரிக்கை|క్లెయిమ్|ಕ್ಲೈಮ್/, ["claim", "documents"]],
  [/कैशलेस|கேஷ்லெஸ்|క్యాష్‌లెస్|ಕ್ಯಾಶ್‌ಲೆಸ್/, ["cashless", "network"]],
  [/दस्तावेज|कागज|ஆவண|పత్రాల|ದಾಖಲೆ/, ["documents", "claim"]],
  [/आयुर्वेद|ஆயுர்வேத|ఆయుర్వేద|ಆಯುರ್ವೇದ/, ["ayush", "ayurveda"]],
  [/को-पे|सह-भुगतान|कोपे/, ["co-payment"]],
];

const STOP = new Set(
  "a an the is are was were be my our your me we i you it its of in on at to for from by with and or not do does did can could will would should what which who whom how when where why if this that these those there here have has had any all so as than then them they he she his her mother father mom dad son daughter wife husband please tell about".split(
    " ",
  ),
);

export function terms(question: string): string[] {
  const words = normaliseForMatch(question)
    .split(/[^a-z0-9-]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
  const out = new Set<string>();
  for (const w of words) {
    out.add(w.replace(/s$/, ""));
    for (const s of SYNONYMS[w] ?? []) out.add(s);
  }
  const raw = question.toLowerCase();
  for (const [re, english] of INDIC) if (re.test(raw)) english.forEach((e) => out.add(e));
  return [...out];
}

/**
 * Pages to send with a question: the best keyword matches, topped up with the
 * clause pages behind the related checklist items so the answer can always cite
 * the wording (useful when the question is short or in another language).
 */
export function pagesFor(policy: Policy, question: string, max = 5, budget = 32_000): { page: number; text: string }[] {
  const picked = pickPages(policy.pages, question, max, budget);
  if (picked.length >= 3) return picked;
  const hay = `${terms(question).join(" ")} ${question.toLowerCase()}`;
  const related = CHECK_WORDS.filter(([, words]) => words.some((w) => hay.includes(w))).map(([id]) => id);
  const ids: CheckId[] = related.length ? related : ["ped-waiting", "room-rent", "co-payment"];
  let used = picked.reduce((a, p) => a + p.text.length, 0);
  const out = [...picked];
  for (const id of ids) {
    const c = policy.checks.find((x) => x.id === id);
    if (!c?.verified || !c.page || out.some((p) => p.page === c.page) || out.length >= max) continue;
    const text = (policy.pages[c.page - 1] ?? "").slice(0, 12_000);
    if (!text || used + text.length > budget) continue;
    out.push({ page: c.page, text });
    used += text.length;
  }
  return out.sort((a, b) => a.page - b.page);
}

/** Top pages by how often the question's terms appear (rare terms count more). */
export function pickPages(pages: string[], question: string, max = 5, budget = 32_000): { page: number; text: string }[] {
  const t = terms(question);
  if (!t.length) return [];
  const norm = pages.map((p) => normaliseForMatch(p));
  const df = t.map((term) => norm.filter((p) => p.includes(term)).length);
  const scored = norm.map((p, i) => {
    let score = 0;
    t.forEach((term, k) => {
      if (!df[k]) return;
      const count = p.split(term).length - 1;
      if (count) score += (1 + Math.log(count)) * Math.log(1 + pages.length / df[k]);
    });
    return { i, score };
  });
  const out: { page: number; text: string }[] = [];
  let used = 0;
  for (const s of scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score)) {
    if (out.length >= max) break;
    const text = pages[s.i].slice(0, 12_000);
    if (used + text.length > budget) continue;
    out.push({ page: s.i + 1, text });
    used += text.length;
  }
  return out.sort((a, b) => a.page - b.page);
}

/** A compact summary of the policy and family for the assistant's context. */
export function contextFor(policy: Policy, members: Member[]): string {
  const v = verdictFor(policy.checks);
  const f = policy.facts;
  const si = f.sumInsuredInr ?? policy.answers.sumInsuredInr;
  const cap = roomCapPerDay(policy);
  const covered = members.filter((m) => policy.memberIds.includes(m.id));
  const lines = [
    `Policy: ${f.productName ?? policy.label}${f.insurerName ? ` by ${f.insurerName}` : ""}${f.policyNumber ? `, no. ${f.policyNumber}` : ""}`,
    `Sum insured: ${si ? formatLakh(si) : "not established"}${!f.sumInsuredInr && si ? " (told by the family)" : ""}. Type: ${f.policyType ?? "not stated"}.`,
    `Policy period: ${f.policyStart ?? "?"} to ${f.policyEnd ?? "?"}. First bought: ${f.firstInception ?? policy.answers.firstInception ?? "not stated"}.`,
    `Covered family: ${covered.map((m) => { const cp = coPayFor(policy.numbers, m, coverStart(policy)); return `${m.name} (${m.relation}, ${m.age}${cp ? `, ${cp}% co-pay` : ", no co-pay"})`; }).join("; ") || "not set"}.`,
    cap ? `Room rent cap: ₹${cap.toLocaleString("en-IN")} a day.` : "",
    `InsureWise checklist score ${v.score}/100 (${v.label}).`,
    ...CHECKS.map((d) => {
      const c = policy.checks.find((x) => x.id === d.id);
      return c ? `- ${d.term}: ${c.status}${c.value ? ` (${c.value})` : ""}${c.page ? ` [page ${c.page}]` : ""}` : "";
    }),
    ...waitingFor(policy).map((w) => `- Waiting: ${w.title} ${w.length}${w.endsOn ? `, ${w.done ? "ended" : "ends"} ${formatDate(w.endsOn)}` : ""}`),
    policy.numbers.subLimits.length
      ? `Sub-limits: ${policy.numbers.subLimits.map((s) => `${s.procedure} ${s.amountInr ? `₹${s.amountInr.toLocaleString("en-IN")}` : `${s.percentOfSi}% of SI`}${s.per ? ` per ${s.per}` : ""}`).join("; ")}`
      : "",
  ];
  return lines.filter(Boolean).join("\n");
}

const CHECK_WORDS: [CheckId, string[]][] = [
  ["co-payment", ["co-payment", "copay", "co-pay", "share"]],
  ["room-rent", ["room", "rent"]],
  ["disease-sublimits", ["sub-limit", "sublimit", "cap", "cataract"]],
  ["pre-post", ["before", "after", "pre-hospital", "post-hospital", "discharge"]],
  ["ped-waiting", ["pre-existing", "existing", "diabetes", "bp", "thyroid"]],
  ["day-care", ["day care", "daycare", "dialysis", "chemotherapy"]],
  ["restoration", ["restore", "restoration", "refill", "exhaust"]],
  ["no-claim-bonus", ["bonus", "no claim", "no-claim"]],
  ["health-checkup", ["check-up", "checkup", "health check"]],
  ["consumables", ["consumable", "gloves", "masks", "kit"]],
  ["domiciliary", ["home", "domiciliary"]],
  ["ayush", ["ayush", "ayurveda", "homeopathy", "unani", "siddha"]],
  ["sum-insured", ["sum insured", "cover amount", "how much cover"]],
];

/** Offline answer from InsureWise's own checklist, used when live AI is off. */
export function sampleAnswer(policy: Policy, question: string): { text: string; citations: { page: number; quote: string; verified: boolean }[] } {
  const q = question.toLowerCase();
  const hit = CHECK_WORDS.find(([, words]) => words.some((w) => q.includes(w)));
  if (hit) {
    const c = policy.checks.find((x) => x.id === hit[0]);
    const d = CHECK_BY_ID[hit[0]];
    if (c) {
      const text = [`${d.term}: ${c.value || "not found in your documents"}.`, c.explanation, `${d.meaning}`].filter(Boolean).join("\n\n");
      return { text, citations: c.quote && c.page && c.verified ? [{ page: c.page, quote: c.quote, verified: true }] : [] };
    }
  }
  const pages = pickPages(policy.pages, question, 1);
  if (pages.length) {
    const t = terms(question);
    const para = pages[0].text.split(/\n{1,}/).find((l) => t.some((x) => normaliseForMatch(l).includes(x))) ?? pages[0].text.slice(0, 280);
    return {
      text: `Here's the part of your policy that mentions this (page ${pages[0].page}):\n\n"${para.trim().slice(0, 400)}"\n\nTurn on live AI for a plain-language answer.`,
      citations: [],
    };
  }
  return { text: "Your documents don't seem to mention this. Ask your insurer, or upload the full policy wording.", citations: [] };
}

/** Starter questions, personalised with the family's names. */
export function starterQuestions(policy: Policy, members: Member[]): string[] {
  const covered = members.filter((m) => policy.memberIds.includes(m.id));
  const parent = covered.find((m) => m.relation === "parent" || m.relation === "parent-in-law");
  const spouse = covered.find((m) => m.relation === "spouse");
  const qs = [
    "What should I check before a planned admission?",
    "Which room can I take without extra deductions?",
    parent ? `Is ${parent.name.split(" ")[0]}'s diabetes or BP covered?` : "When are illnesses I already had covered?",
    spouse ? "Is pregnancy and delivery covered?" : "Does it cover day care procedures like cataract?",
    "What documents do I need for a claim?",
  ];
  return qs;
}
