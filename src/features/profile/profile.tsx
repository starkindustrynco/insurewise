"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowCounterClockwise, PencilSimple, Sparkle, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApp, type Language } from "@/store/app-store";
import { usePreferences } from "@/store/preferences-store";
import { aiStatus } from "@/lib/ai/client";
import type { AiConfig } from "@/server/ai/config";
import { StepFamily, RELATION_LABEL } from "@/features/onboarding/step-family";
import { LANGUAGES } from "@/lib/languages";

export function Profile() {
  const router = useRouter();
  const { members, policies, language, aiMode, session, setMembers, removePolicy, setLanguage, setAiMode, reset } = useApp();
  const theme = usePreferences((s) => s.theme);
  const setTheme = usePreferences((s) => s.setTheme);
  const [editing, setEditing] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [ai, setAi] = useState<AiConfig | null>(null);

  useEffect(() => {
    void aiStatus(true).then(setAi);
  }, []);

  if (editing)
    return (
      <StepFamily
        initial={members}
        onDone={(m) => {
          setMembers(m);
          setEditing(false);
          toast.success("Family updated");
        }}
      />
    );

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="text-title">Profile</h1>
        {session ? <p className="text-muted-foreground">+91 {session.phone}</p> : null}
      </div>

      <section aria-labelledby="fam" className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 id="fam" className="text-heading">
            Family
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <PencilSimple aria-hidden /> Edit
          </Button>
        </div>
        <ul className="surface-card divide-y divide-border">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-4 py-3">
              <span className="font-medium">{m.name}</span>
              <span className="text-support text-muted-foreground">
                {RELATION_LABEL[m.relation]} · {m.age} yrs
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pols" className="flex flex-col gap-2.5">
        <h2 id="pols" className="text-heading px-1">
          Policies
        </h2>
        <ul className="surface-card divide-y divide-border">
          {policies.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.label}</span>
                <span className="block text-[0.8rem] text-muted-foreground">
                  {p.files.length} {p.files.length === 1 ? "file" : "files"} · {p.ai.live ? "read by Gemini" : "sample engine"}
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${p.label}`}
                onClick={() => {
                  removePolicy(p.id);
                  toast("Policy removed");
                }}
              >
                <Trash aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="prefs" className="flex flex-col gap-4">
        <h2 id="prefs" className="text-heading px-1">
          Preferences
        </h2>
        <div className="surface-card flex flex-col gap-5 p-4">
          <div className="flex flex-col gap-2">
            <span className="font-medium">Assistant language</span>
            <Segmented<Language>
              label="Assistant language"
              value={language}
              onValueChange={setLanguage}
              options={LANGUAGES.map((l) => ({ value: l.code, label: l.native }))}
              wrap
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-medium">Theme</span>
            <Segmented
              label="Theme"
              value={theme}
              onValueChange={setTheme}
              options={[
                { value: "system", label: "Auto" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          </div>
          <label className="flex items-start justify-between gap-4">
            <span>
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkle className="size-4 text-accent" weight="fill" aria-hidden /> Use live AI
              </span>
              <span className="block text-support text-muted-foreground">
                {ai == null ? "Checking…" : ai.live ? `Connected: ${ai.provider} (${ai.model})` : (ai.reason ?? "Not available")}
              </span>
            </span>
            <Switch checked={aiMode === "auto"} onCheckedChange={(v) => setAiMode(v ? "auto" : "sample")} />
          </label>
        </div>
      </section>

      <Button variant="secondary" onClick={() => setConfirmReset(true)}>
        <ArrowCounterClockwise aria-hidden /> Start over
      </Button>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start over?</DialogTitle>
            <DialogDescription>This removes your family, policies and chats from this browser.</DialogDescription>
          </DialogHeader>
          <DialogBody />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                reset();
                router.replace("/");
              }}
            >
              Remove everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
