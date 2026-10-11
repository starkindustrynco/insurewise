"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/store/app-store";

/** True once the saved demo data has loaded from this browser. */
export function useHydrated(): boolean {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (useApp.persist.hasHydrated()) setDone(true);
    return useApp.persist.onFinishHydration(() => setDone(true));
  }, []);
  return done;
}
