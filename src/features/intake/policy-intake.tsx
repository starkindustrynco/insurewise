"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle, CircleNotch, FilePdf, Plus, Sparkle, UploadSimple, WarningCircle, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { analyse, loadSampleFile, orderFiles, readFilesText, toPolicy, type ReadFile } from "@/lib/intake";
import { AiError } from "@/lib/ai/client";
import { withAnswers } from "@/domain/policy/read";
import type { DocKind, Member, Policy } from "@/domain/types";
import { formatLakh, tidyName } from "@/domain/policy/framework";
import { useApp } from "@/store/app-store";
import { cn } from "@/lib/utils/cn";

const KIND_LABEL: Record<DocKind, string> = {
  "policy-schedule": "Policy schedule",
  "policy-wording": "Policy wording",
  "summary-sheet": "Customer information sheet",
  brochure: "Brochure",
  "health-card": "Health card",
  "premium-receipt": "Premium receipt",
  other: "Other document",
};

const TIPS = [
  "A room rent cap can cut your whole bill, not just the room charge.",
  "Co-payment means you pay a share of every claim, even approved ones.",
  "Illnesses you had before buying are covered only after a waiting period.",
  "Gloves, masks and kits can be 5–10% of a hospital bill.",
  "Something your policy doesn't mention isn't automatically excluded. Ask your insurer.",
];

const SI_CHOICES = [300000, 500000, 1000000, 1500000, 2500000, 5000000];

type Phase = "upload" | "reading" | "check" | "error";

interface FileEntry extends ReadFile {
  status: "ready";
}

/**
 * Upload → AI reads → document check and quick questions. Ends with a policy
 * ready for the verdict. Used in onboarding and when adding another policy.
 */
export function PolicyIntake({
  members,
  onDone,
  compact,
  initialFiles,
}: {
  members: Member[];
  onDone: (p: Policy) => void;
  compact?: boolean;
  initialFiles?: ReadFile[];
}) {
  const aiMode = useApp((s) => s.aiMode);
  const [phase, setPhase] = useState<Phase>("upload");
  const [files, setFiles] = useState<FileEntry[]>(() => (initialFiles ?? []).map((f) => ({ ...f, status: "ready" as const })));
  const [failed, setFailed] = useState<{ name: string; reason: string }[]>([]);
  const [busyReading, setBusyReading] = useState(false);
  const [isSample, setIsSample] = useState(false);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [error, setError] = useState<{ message: string; code: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLInputElement>(null);

  const addFiles = async (list: FileList | null): Promise<FileEntry[]> => {
    if (!list?.length) return files;
    setBusyReading(true);
    const { ok, failed: bad } = await readFilesText(Array.from(list).slice(0, 4));
    setBusyReading(false);
    setFailed(bad);
    const next = [...files.filter((f) => !ok.some((o) => o.name === f.name)), ...ok.map((f) => ({ ...f, status: "ready" as const }))].slice(0, 4);
    setFiles(next);
    setIsSample(false);
    return next;
  };

  const run = async (picked: FileEntry[], sample: boolean) => {
    setPhase("reading");
    setError(null);
    const list = orderFiles(picked);
    try {
      const outcome = await analyse(list, { isSample: sample, aiMode });
      const p = toPolicy(outcome, list, members);
      setPolicy(p);
      setPhase("check");
    } catch (e) {
      const err = e instanceof AiError ? e : new AiError("Something went wrong while reading.", "unknown");
      setError({ message: err.message, code: err.code });
      setPhase("error");
    }
  };

  const startSample = async () => {
    setBusyReading(true);
    try {
      const f = await loadSampleFile();
      const list = [{ ...f, status: "ready" as const }];
      setFiles(list);
      setIsSample(true);
      setBusyReading(false);
      await run(list, true);
    } catch {
      setBusyReading(false);
      setError({ message: "The sample policy couldn't be loaded.", code: "sample" });
      setPhase("error");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf,text/plain,.txt"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={addRef}
        type="file"
        accept="application/pdf,.pdf,text/plain,.txt"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={async (e) => {
          const next = await addFiles(e.target.files);
          e.target.value = "";
          if (next.length) await run(next, false);
        }}
      />

      {phase === "upload" ? (
        <UploadPhase
          compact={compact}
          files={files}
          failed={failed}
          busy={busyReading}
          onPick={() => inputRef.current?.click()}
          onDrop={(list) => void addFiles(list)}
          onRemove={(name) => setFiles((f) => f.filter((x) => x.name !== name))}
          onRead={() => void run(files, isSample)}
          onSample={() => void startSample()}
        />
      ) : null}

      {phase === "reading" ? <ReadingPhase pages={files.reduce((a, f) => a + f.pages.length, 0)} live={!isSample || aiMode === "auto"} /> : null}

      {phase === "error" && error ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger-soft p-4">
            <WarningCircle className="mt-0.5 size-6 shrink-0 text-danger" weight="fill" aria-hidden />
            <div>
              <p className="font-medium">We couldn't read that</p>
              <p className="text-support text-foreground-soft">{error.message}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {error.code !== "not-policy" && error.code !== "no-text" && files.length ? (
              <Button onClick={() => void run(files, isSample)}>Try again</Button>
            ) : null}
            <Button variant="secondary" onClick={() => setPhase("upload")}>
              Choose other files
            </Button>
            <Button variant="ghost" onClick={() => void startSample()}>
              Try the sample policy
            </Button>
          </div>
        </div>
      ) : null}

      {phase === "check" && policy ? (
        <CheckPhase policy={policy} members={members} onAddMissing={() => addRef.current?.click()} onDone={(p) => onDone(withAnswers(p))} />
      ) : null}
    </div>
  );
}

function UploadPhase({
  compact,
  files,
  failed,
  busy,
  onPick,
  onDrop,
  onRemove,
  onRead,
  onSample,
}: {
  compact?: boolean;
  files: FileEntry[];
  failed: { name: string; reason: string }[];
  busy: boolean;
  onPick: () => void;
  onDrop: (f: FileList) => void;
  onRemove: (name: string) => void;
  onRead: () => void;
  onSample: () => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div className="flex flex-col gap-5">
      {!compact ? (
        <div className="flex flex-col gap-1">
          <h1 className="text-title">Upload your policy</h1>
          <p className="text-muted-foreground">The PDF your insurer emailed you. Add the policy schedule and the policy wording if you have both.</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onPick}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          onDrop(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-2 focus-visible:outline-ring",
          over ? "border-accent bg-accent-soft" : "border-border-strong bg-surface hover:bg-surface-muted",
        )}
      >
        {busy ? <CircleNotch className="size-8 animate-spin text-accent" aria-hidden /> : <UploadSimple className="size-8 text-accent" aria-hidden />}
        <span className="font-medium">{busy ? "Reading your file…" : "Choose PDF files"}</span>
        <span className="text-support text-muted-foreground">or drop them here · up to 4 files</span>
      </button>

      {files.length ? (
        <ul className="flex flex-col gap-2">
          {files.map((f) => (
            <li key={f.name} className="surface-card flex items-center gap-3 px-3 py-2.5">
              <FilePdf className="size-6 shrink-0 text-danger" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9rem] font-medium">{f.name}</span>
                <span className="block text-[0.8rem] text-muted-foreground">
                  {f.pages.length} {f.pages.length === 1 ? "page" : "pages"} read
                </span>
              </span>
              <CheckCircle className="size-5 shrink-0 text-success" weight="fill" aria-label="Ready" />
              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${f.name}`} onClick={() => onRemove(f.name)}>
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {failed.map((f) => (
        <p key={f.name} role="alert" className="text-support text-danger-foreground">
          {f.name}: {f.reason}
        </p>
      ))}

      <div className="flex flex-col gap-2">
        <Button size="lg" block disabled={!files.length || busy} onClick={onRead}>
          <Sparkle weight="fill" aria-hidden /> Read my policy
        </Button>
        <Button variant="ghost" block onClick={onSample} disabled={busy}>
          No policy handy? Try a sample policy
        </Button>
      </div>
      <p className="text-center text-[0.8rem] text-muted-foreground">
        The text is read in your browser and sent to Google Gemini to find the terms. Use a sample if your file has details you'd rather not share.
      </p>
    </div>
  );
}

function ReadingPhase({ pages, live }: { pages: number; live: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    const u = setInterval(() => setTip((i) => (i + 1) % TIPS.length), 5000);
    return () => {
      clearInterval(t);
      clearInterval(u);
    };
  }, []);
  const expected = live ? Math.min(75, 12 + pages * 1.1) : 3;
  const steps = [
    `Reading ${pages} ${pages === 1 ? "page" : "pages"}`,
    "Finding limits, co-payments and waiting periods",
    "Checking every quote against your file",
    "Scoring against the checklist",
  ];
  const at = Math.min(steps.length - 1, Math.floor((elapsed / expected) * steps.length));
  const pct = Math.min(95, Math.round((elapsed / expected) * 100));

  return (
    <div className="flex flex-col gap-6 py-4" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="grid size-16 place-items-center rounded-2xl bg-accent-soft">
          <Sparkle className="size-8 animate-pulse text-accent" weight="fill" aria-hidden />
        </span>
        <h1 className="text-title">Reading your policy</h1>
        <p className="text-muted-foreground">{live ? "Usually 30 seconds to a minute for a long wording." : "This takes a few seconds."}</p>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-surface-sunken"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Reading progress"
      >
        <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
      </div>
      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <li key={s} className={cn("flex items-center gap-3", i > at && "text-faint-foreground")}>
            {i < at ? (
              <CheckCircle className="size-5 text-success" weight="fill" aria-hidden />
            ) : i === at ? (
              <CircleNotch className="size-5 animate-spin text-accent" aria-hidden />
            ) : (
              <span className="size-5 rounded-full border-2 border-border" aria-hidden />
            )}
            {s}
          </li>
        ))}
      </ol>
      <AnimatePresence mode="wait">
        <motion.p
          key={tip}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="rounded-xl bg-surface-muted px-4 py-3 text-center text-support text-foreground-soft"
        >
          Did you know? {TIPS[tip]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function CheckPhase({
  policy,
  members,
  onAddMissing,
  onDone,
}: {
  policy: Policy;
  members: Member[];
  onAddMissing: () => void;
  onDone: (p: Policy) => void;
}) {
  const needSi = !policy.facts.sumInsuredInr;
  const needStart = !policy.facts.firstInception && !policy.facts.policyStart;
  const [si, setSi] = useState<number | null>(null);
  const [start, setStart] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>(policy.memberIds);
  const missing = policy.missing;
  const everythingFound = !missing.length && !needSi && !needStart;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-title">{everythingFound ? "We have what we need" : "Almost there"}</h1>
        <p className="text-muted-foreground">
          {policy.facts.productName ?? policy.label}
          {policy.facts.insurerName ? ` · ${tidyName(policy.facts.insurerName)}` : ""}
        </p>
      </div>

      <section aria-labelledby="found" className="flex flex-col gap-2">
        <h2 id="found" className="font-medium">
          What you uploaded
        </h2>
        <ul className="flex flex-col gap-2">
          {policy.files.map((f) => (
            <li key={f.name} className="flex items-center gap-3 rounded-xl bg-success-soft/60 px-3 py-2.5">
              <CheckCircle className="size-5 shrink-0 text-success" weight="fill" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{KIND_LABEL[f.kind]}</span>
                <span className="block truncate text-[0.8rem] text-muted-foreground">{f.name}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {missing.length ? (
        <section aria-labelledby="missing" className="flex flex-col gap-2">
          <h2 id="missing" className="font-medium">
            Worth adding
          </h2>
          {missing.map((m) => (
            <div key={m.kind} className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning-soft/60 p-3.5">
              <div className="flex items-start gap-3">
                <WarningCircle className="mt-0.5 size-5 shrink-0 text-warning-foreground" weight="fill" aria-hidden />
                <div>
                  <p className="font-medium">{m.title}</p>
                  <p className="text-support text-foreground-soft">{m.why}</p>
                </div>
              </div>
              <Button variant="secondary" size="sm" className="self-start" onClick={onAddMissing}>
                <Plus aria-hidden /> Add {m.title.toLowerCase()}
              </Button>
            </div>
          ))}
        </section>
      ) : null}

      {needSi ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">What's your cover amount (sum insured)?</legend>
          <p className="text-support text-muted-foreground">It's on your policy schedule or health card.</p>
          <div className="flex flex-wrap gap-2">
            {SI_CHOICES.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={si === v}
                onClick={() => setSi(si === v ? null : v)}
                className={cn(
                  "h-10 rounded-full border px-4 text-[0.9rem] font-medium transition-colors",
                  si === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-surface-muted",
                )}
              >
                {formatLakh(v)}
                {v === 5000000 ? "+" : ""}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {needStart ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="since">When did you first buy this policy?</Label>
          <p className="text-support text-muted-foreground">Waiting periods count from then, including years with the same insurer before.</p>
          <Input
            id="since"
            type="month"
            value={start}
            max={new Date().toISOString().slice(0, 7)}
            onChange={(e) => setStart(e.target.value)}
            className="max-w-56"
          />
        </div>
      ) : null}

      {members.length > 1 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">Who does this policy cover?</legend>
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
              <Checkbox
                checked={memberIds.includes(m.id)}
                onCheckedChange={(v) => setMemberIds((ids) => (v ? [...ids, m.id] : ids.filter((x) => x !== m.id)))}
              />
              <span className="flex-1">{m.name}</span>
              <span className="text-support text-muted-foreground">{m.age} yrs</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      <Button
        size="lg"
        block
        disabled={members.length > 1 && memberIds.length === 0}
        onClick={() =>
          onDone({
            ...policy,
            memberIds: members.length > 1 ? memberIds : members.map((m) => m.id),
            answers: { ...(si ? { sumInsuredInr: si } : {}), ...(start ? { firstInception: `${start}-01` } : {}) },
          })
        }
      >
        See my verdict <ArrowRight weight="bold" aria-hidden />
      </Button>
    </div>
  );
}
