"use client";

import { motion } from "framer-motion";
import type { ScoreLabel } from "@/domain/policy/framework";
import { cn } from "@/lib/utils/cn";

const TONE: Record<ScoreLabel, string> = {
  Excellent: "var(--success)",
  Good: "var(--accent)",
  Fair: "var(--warning)",
  "Needs attention": "var(--danger)",
};

/** Policy score out of 100 as a ring, with the number and label inside. */
export function ScoreRing({ score, label, size = 132, className }: { score: number; label: ScoreLabel; size?: number; className?: string }) {
  const stroke = Math.max(6, Math.round(size / 12));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className={cn("relative grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TONE[label]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - score / 100) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center" role="img" aria-label={`Score ${score} out of 100, ${label}`}>
        <div>
          <div className="tabular font-semibold leading-none tracking-tight" style={{ fontSize: Math.round(size * 0.29) }}>
            {score}
          </div>
          {size >= 96 ? <div className="mt-1 text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">out of 100</div> : null}
        </div>
      </div>
    </div>
  );
}

export const LABEL_TONE: Record<ScoreLabel, "success" | "accent" | "warning" | "danger"> = {
  Excellent: "success",
  Good: "accent",
  Fair: "warning",
  "Needs attention": "danger",
};
