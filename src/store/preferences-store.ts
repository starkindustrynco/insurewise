"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Display preferences, kept separately so a demo reset doesn't change them. */
export interface Preferences {
  theme: "system" | "light" | "dark";
  largerText: boolean;
  reduceMotion: "system" | "on";
  setTheme: (t: Preferences["theme"]) => void;
}

export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      theme: "system",
      largerText: false,
      reduceMotion: "system",
      setTheme: (theme) => set({ theme }),
    }),
    { name: "insurewise-preferences", storage: createJSONStorage(() => localStorage) },
  ),
);
