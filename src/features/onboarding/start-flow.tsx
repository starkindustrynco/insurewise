"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "@phosphor-icons/react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { PolicyIntake } from "@/features/intake/policy-intake";
import { useApp } from "@/store/app-store";
import { StepFamily } from "./step-family";
import { StepLogin } from "./step-login";
import { cn } from "@/lib/utils/cn";

type Step = "login" | "family" | "policy";
const STEPS: { id: Step; label: string }[] = [
  { id: "login", label: "Sign in" },
  { id: "family", label: "Family" },
  { id: "policy", label: "Policy" },
];

/** Onboarding: sign in → family → upload and read the policy → verdict. */
export function StartFlow() {
  const router = useRouter();
  const { session, members, onboarded, login, setMembers, addPolicy, completeOnboarding } = useApp();
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<Step>("login");

  useEffect(() => {
    const done = () => setHydrated(true);
    if (useApp.persist.hasHydrated()) done();
    return useApp.persist.onFinishHydration(done);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (onboarded) router.replace("/app");
    else if (session) setStep(members.length ? "policy" : "family");
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const index = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-lg items-center justify-between px-5 py-4">
        <Link href="/" aria-label="InsureWise home">
          <Logo />
        </Link>
        <ol className="flex items-center gap-1.5" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s.id} aria-current={i === index ? "step" : undefined} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-6 bg-accent" : i < index ? "w-3 bg-accent/60" : "w-3 bg-border-strong",
                )}
              />
              <span className="sr-only">
                {s.label}
                {i < index ? " (done)" : ""}
              </span>
            </li>
          ))}
        </ol>
      </header>

      <main id="main" className="mx-auto max-w-lg px-5 pb-16 pt-2">
        {index > 0 ? (
          <Button variant="ghost" size="sm" className="-ml-2 mb-3" onClick={() => setStep(STEPS[index - 1].id)}>
            <ArrowLeft aria-hidden /> Back
          </Button>
        ) : null}
        {!hydrated ? null : (
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              {step === "login" ? (
                <StepLogin
                  onDone={(phone) => {
                    login(phone);
                    setStep("family");
                  }}
                />
              ) : null}
              {step === "family" ? (
                <StepFamily
                  initial={members}
                  onDone={(m) => {
                    setMembers(m);
                    setStep("policy");
                  }}
                />
              ) : null}
              {step === "policy" ? (
                <PolicyIntake
                  members={members}
                  onDone={(p) => {
                    addPolicy(p);
                    completeOnboarding();
                    router.push("/app?welcome=1");
                  }}
                />
              ) : null}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}
