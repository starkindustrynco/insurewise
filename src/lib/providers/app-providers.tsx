"use client";

import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePreferences } from "@/store/preferences-store";
import { STORAGE_KEY, useApp } from "@/store/app-store";
import { ThemeController } from "./theme-controller";

/** Keeps open tabs in step (for example the hospital view opened from a card). */
function CrossTabSync() {
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) void useApp.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const reduceMotion = usePreferences((s) => s.reduceMotion);
  return (
    <MotionConfig reducedMotion={reduceMotion === "on" ? "always" : "user"}>
      <TooltipProvider delayDuration={250}>
        <ThemeController />
        <CrossTabSync />
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            classNames: {
              toast: "!rounded-xl !border !border-border !bg-surface-raised !text-foreground !shadow-raised !font-sans !text-sm !gap-2.5",
              description: "!text-muted-foreground",
              actionButton: "!bg-primary !text-primary-foreground !rounded-md",
              success: "[&_[data-icon]]:!text-success",
              error: "[&_[data-icon]]:!text-danger",
            },
          }}
        />
      </TooltipProvider>
    </MotionConfig>
  );
}
