"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Microphone, Quotes, SpeakerHigh, SpeakerSlash, Sparkle, Trash, Translate } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { activePolicy, newId, useApp, type Language } from "@/store/app-store";
import { ai, aiStatus, AiError } from "@/lib/ai/client";
import { contextFor, pagesFor, sampleAnswer, starterQuestions } from "@/lib/assistant";
import { LANGUAGES, LANGUAGE_BY_CODE } from "@/lib/languages";
import { useDictation, useSpeak } from "@/hooks/use-speech";
import { pageLabel } from "@/components/verdict/checklist";
import { cn } from "@/lib/utils/cn";

export function Ask() {
  const params = useSearchParams();
  const router = useRouter();
  const policy = useApp((s) => activePolicy(s));
  const members = useApp((s) => s.members);
  const chat = useApp((s) => s.chat);
  const language = useApp((s) => s.language);
  const aiMode = useApp((s) => s.aiMode);
  const { addChat, clearChat, setLanguage } = useApp.getState();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [showEnglish, setShowEnglish] = useState<Record<string, boolean>>({});
  const endRef = useRef<HTMLDivElement>(null);
  const asked = useRef(false);
  const speech = LANGUAGE_BY_CODE[language].speech;
  const dictation = useDictation(speech, (t) => setText(t));
  const { supported: canSpeak, speakingId, speak } = useSpeak();

  const thread = chat.filter((m) => !policy || !m.policyId || m.policyId === policy.id);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread.length, pending]);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || !policy || pending) return;
    setText("");
    dictation.stop();
    addChat({ id: newId("msg"), role: "user", text: q, policyId: policy.id, at: new Date().toISOString() });
    setPending(true);
    const history = thread.slice(-4).map((m) => ({ role: m.role, text: m.english ?? m.text }));
    try {
      const status = await aiStatus();
      if (!status.live || aiMode === "sample") throw new AiError("sample", "ai-off");
      const r = await ai.ask({
        question: q,
        language,
        context: contextFor(policy, members),
        pages: pagesFor(policy, q),
        history,
      });
      addChat({
        id: newId("msg"),
        role: "assistant",
        text: r.answer,
        english: r.answerEnglish ?? undefined,
        citations: r.citations,
        followUps: r.followUps,
        status: r.status,
        engine: "live",
        language,
        policyId: policy.id,
        at: new Date().toISOString(),
      });
    } catch (e) {
      const s = sampleAnswer(policy, q);
      const reason = e instanceof AiError && e.code !== "ai-off" ? `Live AI didn't answer (${e.message}). ` : "";
      addChat({
        id: newId("msg"),
        role: "assistant",
        text: `${reason}${s.text}`,
        citations: s.citations,
        engine: "sample",
        language: "en",
        policyId: policy.id,
        at: new Date().toISOString(),
      });
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    const q = params.get("q");
    if (q && !asked.current && policy) {
      asked.current = true;
      router.replace("/app/ask");
      void send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, policy]);

  if (!policy) return <p className="py-16 text-center text-muted-foreground">Add a policy first.</p>;
  const starters = starterQuestions(policy, members);

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-title">Ask</h1>
          <p className="text-support text-muted-foreground">About {policy.label}. Answers come from your policy pages.</p>
        </div>
        {thread.length ? (
          <Button variant="ghost" size="icon-sm" aria-label="Clear conversation" onClick={clearChat}>
            <Trash aria-hidden />
          </Button>
        ) : null}
      </div>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 scrollbar-none" role="radiogroup" aria-label="Answer language">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            role="radio"
            aria-checked={language === l.code}
            onClick={() => setLanguage(l.code as Language)}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3 text-[0.85rem] font-medium",
              language === l.code ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground-soft",
            )}
          >
            {l.native}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-4" aria-live="polite">
        {thread.length === 0 ? (
          <div className="flex flex-col gap-2 pt-2">
            <p className="text-support text-muted-foreground">Try asking</p>
            {starters.map((q) => (
              <button
                key={q}
                onClick={() => void send(q)}
                className="rounded-2xl border border-border bg-surface px-4 py-3 text-left text-[0.92rem] transition-colors hover:border-border-strong hover:bg-surface-muted"
              >
                {q}
              </button>
            ))}
          </div>
        ) : null}

        <AnimatePresence initial={false}>
          {thread.map((m) =>
            m.role === "user" ? (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="ml-10 self-end rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground"
              >
                {m.text}
              </motion.div>
            ) : (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mr-4 flex flex-col gap-3 rounded-2xl rounded-bl-md border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  {m.engine === "live" ? (
                    <Badge tone="accent">
                      <Sparkle weight="fill" aria-hidden /> Gemini
                    </Badge>
                  ) : (
                    <Badge tone="outline">Sample answer</Badge>
                  )}
                  {m.status === "partly" ? (
                    <Badge tone="warning">Partly answered</Badge>
                  ) : m.status === "unclear" ? (
                    <Badge tone="neutral">Not clear from your documents</Badge>
                  ) : null}
                  {m.english ? (
                    <Badge tone="outline">
                      <Translate aria-hidden /> AI translation
                    </Badge>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2 whitespace-pre-line leading-relaxed" lang={m.language && !showEnglish[m.id] ? m.language : "en"}>
                  {showEnglish[m.id] && m.english ? m.english : m.text}
                </div>
                {m.citations?.length ? (
                  <div className="flex flex-col gap-2">
                    {m.citations.map((c) => (
                      <details key={`${c.page}-${c.quote.slice(0, 12)}`} className="group rounded-xl bg-surface-muted/70 px-3 py-2">
                        <summary className="flex cursor-pointer list-none items-center gap-2 text-[0.82rem] font-medium text-foreground-soft">
                          <Quotes className="size-4 text-faint-foreground" weight="fill" aria-hidden />
                          {pageLabel(c.page, policy.pageRefs)}
                          <span className="text-muted-foreground">· found in your document</span>
                        </summary>
                        <p className="mt-1.5 text-[0.85rem] italic text-foreground-soft">{c.quote}</p>
                      </details>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-3 text-[0.82rem]">
                  {m.english ? (
                    <button
                      className="font-medium text-accent-strong hover:underline"
                      onClick={() => setShowEnglish((s) => ({ ...s, [m.id]: !s[m.id] }))}
                    >
                      {showEnglish[m.id] ? `Show in ${LANGUAGE_BY_CODE[m.language ?? "en"].label}` : "Show in English"}
                    </button>
                  ) : null}
                  {canSpeak ? (
                    <button
                      className="inline-flex items-center gap-1 font-medium text-accent-strong hover:underline"
                      onClick={() =>
                        speak(
                          m.id,
                          showEnglish[m.id] && m.english ? m.english : m.text,
                          showEnglish[m.id] ? "en-IN" : LANGUAGE_BY_CODE[m.language ?? "en"].speech,
                        )
                      }
                    >
                      {speakingId === m.id ? <SpeakerSlash className="size-4" aria-hidden /> : <SpeakerHigh className="size-4" aria-hidden />}
                      {speakingId === m.id ? "Stop" : "Listen"}
                    </button>
                  ) : null}
                </div>
                {m.followUps?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {m.followUps.map((f) => (
                      <button
                        key={f}
                        onClick={() => void send(f)}
                        className="rounded-full border border-border px-3 py-1.5 text-left text-[0.82rem] hover:bg-surface-muted"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                ) : null}
              </motion.div>
            ),
          )}
        </AnimatePresence>
        {pending ? (
          <div className="mr-4 flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-support text-muted-foreground">
            <Sparkle className="size-4 animate-pulse text-accent" weight="fill" aria-hidden /> Reading your policy pages…
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <form
        className="sticky bottom-20 flex items-end gap-2 rounded-2xl border border-border bg-surface p-2 shadow-raised md:bottom-4"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <textarea
          aria-label="Your question"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(text);
            }
          }}
          placeholder={dictation.listening ? "Listening…" : "Ask about your policy"}
          maxLength={600}
          className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[0.95rem] outline-none placeholder:text-faint-foreground"
        />
        {dictation.supported ? (
          <Button
            type="button"
            variant={dictation.listening ? "danger" : "ghost"}
            size="icon"
            aria-label={dictation.listening ? "Stop listening" : `Speak in ${LANGUAGE_BY_CODE[language].label}`}
            aria-pressed={dictation.listening}
            onClick={() => (dictation.listening ? dictation.stop() : dictation.start())}
          >
            <Microphone weight={dictation.listening ? "fill" : "regular"} aria-hidden />
          </Button>
        ) : null}
        <Button type="submit" size="icon" aria-label="Send" disabled={!text.trim() || pending}>
          <ArrowUp weight="bold" aria-hidden />
        </Button>
      </form>
      {dictation.error ? <p className="-mt-2 text-support text-danger-foreground">{dictation.error}</p> : null}
      <p className="-mt-2 text-center text-[0.75rem] text-muted-foreground">AI can be wrong. Only your insurer decides claims.</p>
    </div>
  );
}
