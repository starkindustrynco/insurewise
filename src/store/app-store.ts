"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Member, Policy } from "@/domain/types";
import type { DecodeResult } from "@/server/ai/services";
import { withAnswers } from "@/domain/policy/read";

export type Language = "en" | "hi" | "ta" | "te" | "kn";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** English version of a translated answer. */
  english?: string;
  citations?: { page: number; quote: string; verified: boolean }[];
  engine?: "live" | "sample";
  status?: "answered" | "partly" | "unclear";
  followUps?: string[];
  language?: Language;
  policyId?: string;
  at: string;
}

export interface AppState {
  session: { phone: string } | null;
  onboarded: boolean;
  members: Member[];
  policies: Policy[];
  activePolicyId: string | null;
  language: Language;
  /** "auto" uses live AI when the server has a key; "sample" always uses the built-in sample engine. */
  aiMode: "auto" | "sample";
  chat: ChatMessage[];
  lastDecode: { result: DecodeResult; fileName: string; engine: "live" | "sample"; at: string } | null;

  login: (phone: string) => void;
  logout: () => void;
  setMembers: (members: Member[]) => void;
  upsertMember: (m: Member) => void;
  removeMember: (id: string) => void;
  addPolicy: (p: Policy) => void;
  updatePolicy: (id: string, patch: Partial<Policy>) => void;
  removePolicy: (id: string) => void;
  setActivePolicy: (id: string) => void;
  completeOnboarding: () => void;
  setLanguage: (l: Language) => void;
  setAiMode: (m: "auto" | "sample") => void;
  addChat: (m: ChatMessage) => void;
  clearChat: () => void;
  setLastDecode: (d: AppState["lastDecode"]) => void;
  reset: () => void;
}

export const STORAGE_KEY = "insurewise-v2";

const initial = {
  session: null,
  onboarded: false,
  members: [] as Member[],
  policies: [] as Policy[],
  activePolicyId: null,
  language: "en" as Language,
  aiMode: "auto" as const,
  chat: [] as ChatMessage[],
  lastDecode: null as AppState["lastDecode"],
};

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      ...initial,
      login: (phone) => set({ session: { phone } }),
      logout: () => set({ session: null }),
      setMembers: (members) => set({ members }),
      upsertMember: (m) =>
        set((s) => ({ members: s.members.some((x) => x.id === m.id) ? s.members.map((x) => (x.id === m.id ? m : x)) : [...s.members, m] })),
      removeMember: (id) =>
        set((s) => ({
          members: s.members.filter((m) => m.id !== id),
          policies: s.policies.map((p) => ({ ...p, memberIds: p.memberIds.filter((x) => x !== id) })),
        })),
      addPolicy: (p) => set((s) => ({ policies: [...s.policies.filter((x) => x.id !== p.id), withAnswers(p)], activePolicyId: p.id })),
      updatePolicy: (id, patch) => set((s) => ({ policies: s.policies.map((p) => (p.id === id ? withAnswers({ ...p, ...patch }) : p)) })),
      removePolicy: (id) =>
        set((s) => {
          const policies = s.policies.filter((p) => p.id !== id);
          return { policies, activePolicyId: s.activePolicyId === id ? (policies[0]?.id ?? null) : s.activePolicyId };
        }),
      setActivePolicy: (id) => set({ activePolicyId: id }),
      completeOnboarding: () => set({ onboarded: true }),
      setLanguage: (language) => set({ language }),
      setAiMode: (aiMode) => set({ aiMode }),
      addChat: (m) => set((s) => ({ chat: [...s.chat, m].slice(-60) })),
      clearChat: () => set({ chat: [] }),
      setLastDecode: (lastDecode) => set({ lastDecode }),
      reset: () => set({ ...initial }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** The policy being looked at, or the first one. */
export function activePolicy(s: Pick<AppState, "policies" | "activePolicyId">): Policy | null {
  return s.policies.find((p) => p.id === s.activePolicyId) ?? s.policies[0] ?? null;
}
