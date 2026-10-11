"use client";

import { useState } from "react";
import { DeviceMobile } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const DEMO_OTP = "123456";

/** Mock sign-in: mobile number and a one-time code. No SMS is sent. */
export function StepLogin({ onDone }: { onDone: (phone: string) => void }) {
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const validPhone = /^[6-9]\d{9}$/.test(phone);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (!sent) {
          if (!validPhone) return setError("Enter a 10-digit Indian mobile number.");
          setSent(true);
          return;
        }
        if (code !== DEMO_OTP) return setError(`That code didn't match. In this demo the code is ${DEMO_OTP}.`);
        onDone(phone);
      }}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-title">Let's get you started</h1>
        <p className="text-muted-foreground">Sign in with your mobile number.</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Mobile number</Label>
        <div className="flex gap-2">
          <span className="inline-flex h-11 items-center rounded-[0.625rem] border border-border bg-surface-muted px-3 text-muted-foreground">
            +91
          </span>
          <Input
            id="phone"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            disabled={sent}
            aria-invalid={Boolean(error && !sent)}
          />
        </div>
      </div>

      {sent ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="otp">6-digit code</Label>
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="tracking-[0.4em]"
            aria-invalid={Boolean(error)}
          />
          <p className="flex items-center justify-between gap-2 text-support text-muted-foreground">
            <span>Demo: no SMS is sent.</span>
            <button type="button" className="font-medium text-accent-strong hover:underline" onClick={() => setCode(DEMO_OTP)}>
              Use code {DEMO_OTP}
            </button>
          </p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-support text-danger-foreground">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" block disabled={sent ? code.length !== 6 : phone.length !== 10}>
        <DeviceMobile aria-hidden /> {sent ? "Verify and continue" : "Send code"}
      </Button>
    </form>
  );
}
