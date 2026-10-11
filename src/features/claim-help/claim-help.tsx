"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowCounterClockwise,
  CheckCircle,
  Copy,
  EnvelopeSimple,
  FileText,
  ListChecks,
  Question,
  Quotes,
  Sparkle,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { activePolicy, useApp } from "@/store/app-store";
import { ai, aiStatus, AiError } from "@/lib/ai/client";
import { contextFor, pickPages } from "@/lib/assistant";
import { extractPolicyText } from "@/lib/pdf/extract-text";
import { SAMPLE_DECODE, SAMPLE_LETTER, SAMPLE_LETTER_NAME } from "@/domain/sample-letter";
import { formatInr } from "@/domain/policy/framework";
import type { DecodeResult } from "@/server/ai/services";
import type { Policy } from "@/domain/types";
import { pageLabel } from "@/components/verdict/checklist";
import { cn } from "@/lib/utils/cn";

const KIND: Record<DecodeResult["documentKind"], string> = {
  "rejection-letter": "Rejection letter",
  "partial-approval": "Partial approval",
  "deduction-letter": "Deduction letter",
  "query-letter": "Query letter",
  "hospital-bill": "Hospital bill",
  "settlement-letter": "Settlement letter",
  "pre-authorisation": "Pre-authorisation",
  other: "Letter",
};

const CHECK = {
  consistent: { label: "Matches your policy", tone: "success" as const, icon: CheckCircle },
  "worth-questioning": { label: "Worth questioning", tone: "warning" as const, icon: WarningCircle },
  unclear: { label: "Not clear from your policy", tone: "neutral" as const, icon: Question },
};

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const;

async function toBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Policy pages most relevant to a letter: those the checklist cites for money rules, plus keyword matches. */
function pagesFor(policy: Policy, text: string | null) {
  const cited = policy.checks
    .filter((c) => c.page && ["room-rent", "co-payment", "consumables", "disease-sublimits", "ped-waiting", "pre-post"].includes(c.id))
    .map((c) => c.page!) as number[];
  const picked = text ? pickPages(policy.pages, text.slice(0, 4000), 6, 30_000).map((p) => p.page) : [];
  const nums = [...new Set([...cited, ...picked])].filter((n) => n >= 1 && n <= policy.pages.length).slice(0, 10);
  return nums.sort((a, b) => a - b).map((n) => ({ page: n, text: policy.pages[n - 1].slice(0, 12_000) }));
}

export function ClaimHelp() {
  const policy = useApp((s) => activePolicy(s));
  const members = useApp((s) => s.members);
  const aiMode = useApp((s) => s.aiMode);
  const last = useApp((s) => s.lastDecode);
  const setLastDecode = useApp((s) => s.setLastDecode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paste, setPaste] = useState(false);
  const [pasted, setPasted] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!policy) return <p className="py-16 text-center text-muted-foreground">Add a policy first.</p>;
  const me = members.find((m) => m.relation === "self");

  const run = async (input: {
    fileName: string;
    text: string | null;
    file: { mediaType: (typeof IMAGE_TYPES)[number] | "application/pdf"; data: string } | null;
    isSample?: boolean;
  }) => {
    setBusy(true);
    setError(null);
    try {
      const status = await aiStatus(true);
      if (!status.live || aiMode === "sample") {
        if (input.isSample) {
          setLastDecode({ result: SAMPLE_DECODE, fileName: input.fileName, engine: "sample", at: new Date().toISOString() });
          return;
        }
        throw new AiError("Live AI is off, so we can't read your letter. Try the sample letter to see how it works.", "ai-off");
      }
      const result = await ai.decode({
        fileName: input.fileName,
        text: input.text,
        file: input.file,
        policyholder: me?.name ?? "Policyholder",
        context: contextFor(policy, members),
        pages: pagesFor(policy, input.text),
      });
      setLastDecode({ result, fileName: input.fileName, engine: "live", at: new Date().toISOString() });
    } catch (e) {
      setError(e instanceof AiError ? e.message : "Something went wrong while reading the letter.");
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File) => {
    if (file.size > 6_000_000) return setError("That file is over 6 MB. Try a smaller photo or the PDF.");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const img = IMAGE_TYPES.find((t) => t === file.type);
    if (!isPdf && !img && !file.type.startsWith("text/")) return setError("Choose a PDF, a photo (JPG or PNG) or a text file.");
    if (file.type.startsWith("text/")) return run({ fileName: file.name, text: (await file.text()).slice(0, 60_000), file: null });
    if (isPdf) {
      try {
        const t = await extractPolicyText(file);
        const text = t.pages.join("\n\n");
        if (text.replace(/\s/g, "").length >= 200) return run({ fileName: file.name, text: text.slice(0, 60_000), file: null });
      } catch {
        /* scanned PDF: send the file itself */
      }
      return run({ fileName: file.name, text: null, file: { mediaType: "application/pdf", data: await toBase64(file) } });
    }
    return run({ fileName: file.name, text: null, file: { mediaType: img!, data: await toBase64(file) } });
  };

  return (
    <div className="flex flex-col gap-6">
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp,text/plain"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onFile(f);
        }}
      />
      <div>
        <h1 className="text-title">Claim help</h1>
        <p className="text-support text-muted-foreground">
          Got a rejection, a deduction or a query from your insurer? We'll explain it against your policy and draft a reply.
        </p>
      </div>

      {!last || busy ? (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border-strong bg-surface px-6 py-10 text-center transition-colors hover:bg-surface-muted disabled:opacity-70"
          >
            {busy ? (
              <Sparkle className="size-8 animate-pulse text-accent" weight="fill" aria-hidden />
            ) : (
              <UploadSimple className="size-8 text-accent" aria-hidden />
            )}
            <span className="font-medium">{busy ? "Reading the letter and your policy…" : "Upload the letter or bill"}</span>
            <span className="text-support text-muted-foreground">{busy ? "Usually 20–40 seconds" : "PDF or a photo from your phone"}</span>
          </button>
          {paste ? (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (pasted.trim().length > 30) void run({ fileName: "Pasted message", text: pasted.trim(), file: null });
              }}
            >
              <Textarea
                aria-label="Letter or message text"
                placeholder="Paste the letter, email or SMS here"
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
              />
              <Button type="submit" disabled={busy || pasted.trim().length <= 30}>
                Decode this
              </Button>
            </form>
          ) : null}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-support">
            <button className="font-medium text-accent-strong hover:underline" onClick={() => setPaste((p) => !p)} disabled={busy}>
              {paste ? "Hide text box" : "Paste text instead"}
            </button>
            <button
              className="font-medium text-accent-strong hover:underline"
              disabled={busy}
              onClick={() => void run({ fileName: SAMPLE_LETTER_NAME, text: SAMPLE_LETTER, file: null, isSample: true })}
            >
              Try a sample letter
            </button>
          </div>
          {error ? (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-support">
              <WarningCircle className="mt-0.5 size-5 shrink-0 text-danger" weight="fill" aria-hidden /> {error}
            </p>
          ) : null}
        </div>
      ) : (
        <Decoded entry={last} policy={policy} onReset={() => setLastDecode(null)} />
      )}
    </div>
  );
}

function Decoded({
  entry,
  policy,
  onReset,
}: {
  entry: NonNullable<ReturnType<typeof useApp.getState>["lastDecode"]>;
  policy: Policy;
  onReset: () => void;
}) {
  const r = entry.result;
  const [subject, setSubject] = useState(r.draft.subject);
  const [body, setBody] = useState(r.draft.body);
  const questionable = r.deductions.filter((d) => d.policyCheck === "worth-questioning");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      toast.success("Letter copied");
    } catch {
      toast.error("Couldn't copy. Select the text instead.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="surface-card flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="ink">{KIND[r.documentKind]}</Badge>
          {entry.engine === "live" ? (
            <Badge tone="accent">
              <Sparkle weight="fill" aria-hidden /> Read by Gemini
            </Badge>
          ) : (
            <Badge tone="outline">Sample</Badge>
          )}
        </div>
        <div>
          <p className="text-[0.8rem] text-muted-foreground">
            <FileText className="mr-1 inline size-4 align-[-3px]" aria-hidden />
            {entry.fileName}
            {r.from ? ` · ${r.from}` : ""}
            {r.claimNumber ? ` · ${r.claimNumber}` : ""}
          </p>
          <p className="mt-2 leading-relaxed">{r.summary}</p>
        </div>
        {r.claimedInr || r.approvedInr || r.deductedInr ? (
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Claimed", r.claimedInr],
              ["Approved", r.approvedInr],
              ["Deducted", r.deductedInr],
            ].map(([k, v]) => (
              <div
                key={k as string}
                className={cn(
                  "rounded-xl p-2.5",
                  k === "Deducted" ? "bg-danger-soft/60" : k === "Approved" ? "bg-success-soft/60" : "bg-surface-muted",
                )}
              >
                <dt className="text-[0.75rem] text-muted-foreground">{k}</dt>
                <dd className="tabular font-semibold">{typeof v === "number" ? formatInr(v) : "—"}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {r.deadline ? <p className="text-support font-medium text-warning-foreground">Reply by: {r.deadline}</p> : null}
      </section>

      {r.deductions.length ? (
        <section aria-labelledby="deductions" className="flex flex-col gap-2.5">
          <h2 id="deductions" className="text-heading px-1">
            Each deduction, explained
          </h2>
          {questionable.length ? (
            <p className="-mt-1 px-1 text-support text-warning-foreground">
              {questionable.length} {questionable.length === 1 ? "looks" : "look"} worth questioning.
            </p>
          ) : null}
          <ul className="flex flex-col gap-2.5">
            {r.deductions.map((d, i) => {
              const c = CHECK[d.policyCheck];
              const Icon = c.icon;
              return (
                <li key={i} className="surface-card flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium leading-snug">{d.item}</p>
                    {d.amountInr ? <p className="tabular shrink-0 font-semibold text-danger-foreground">−{formatInr(d.amountInr)}</p> : null}
                  </div>
                  <Badge tone={c.tone} className="self-start">
                    <Icon weight="fill" aria-hidden /> {c.label}
                  </Badge>
                  <p className="text-support text-muted-foreground">They said: {d.reasonGiven}</p>
                  <p className="text-[0.92rem]">{d.explanation}</p>
                  {d.policyQuote ? (
                    <figure className="rounded-xl bg-surface-muted/70 p-3 text-support">
                      <Quotes className="mb-1 size-4 text-faint-foreground" weight="fill" aria-hidden />
                      <blockquote className="italic text-foreground-soft">{d.policyQuote}</blockquote>
                      <figcaption className="mt-1 text-[0.75rem] text-muted-foreground">
                        {quoteSource(pageLabel(d.policyPage, policy.pageRefs))}
                        {d.quoteVerified ? " · found in your document" : ""}
                      </figcaption>
                    </figure>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {r.requestedDocuments.length ? (
        <section aria-labelledby="docs" className="flex flex-col gap-2.5">
          <h2 id="docs" className="text-heading px-1">
            They're asking for
          </h2>
          <ul className="surface-card divide-y divide-border">
            {r.requestedDocuments.map((d) => (
              <li key={d.document} className="flex gap-3 px-4 py-3">
                <ListChecks className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
                <span>
                  <span className="block font-medium">{d.document}</span>
                  {d.why ? <span className="block text-support text-muted-foreground">{d.why}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="steps" className="flex flex-col gap-2.5">
        <h2 id="steps" className="text-heading px-1">
          What to do next
        </h2>
        <ol className="surface-card flex flex-col gap-3 p-4">
          {r.nextSteps.map((s, i) => (
            <li key={s} className="flex gap-3 text-[0.92rem]">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[0.8rem] font-semibold text-accent-soft-foreground">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
        <p className="px-1 text-[0.8rem] text-muted-foreground">
          If your insurer doesn't resolve a complaint, you can escalate to IRDAI's Bima Bharosa portal and then the Insurance Ombudsman. Both are
          free.
        </p>
      </section>

      <section aria-labelledby="draft" className="flex flex-col gap-2.5">
        <h2 id="draft" className="text-heading px-1">
          Your reply, ready to send
        </h2>
        <div className="surface-card flex flex-col gap-3 p-4">
          <Input aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Textarea aria-label="Letter" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-72" />
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => void copy()}>
              <Copy aria-hidden /> Copy
            </Button>
            <Button asChild variant="secondary">
              <a href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}>
                <EnvelopeSimple aria-hidden /> Open in email
              </a>
            </Button>
          </div>
          <p className="text-[0.78rem] text-muted-foreground">Check the facts before sending. InsureWise never sends anything for you.</p>
        </div>
      </section>

      <Button variant="ghost" onClick={onReset}>
        <ArrowCounterClockwise aria-hidden /> Decode another letter
      </Button>
    </div>
  );
}

/** "Policy Wordings, page 20" for multi-file policies, "Your policy, page 20" otherwise. */
function quoteSource(label: string | null): string {
  if (!label) return "Your policy";
  return label.startsWith("Page ") ? `Your policy, ${label.toLowerCase()}` : label;
}
