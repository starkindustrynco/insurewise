"use client";

import { useEffect } from "react";
import { usePreferences } from "@/store/preferences-store";

function resolveDark(pref: "system" | "light" | "dark"): boolean {
  if (pref === "dark") return true;
  if (pref === "light") return false;
  const host = document.documentElement.getAttribute("data-theme");
  if (host === "dark" || host === "light") return host === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Keeps the `dark` class and text size in sync with preferences. */
export function ThemeController() {
  const theme = usePreferences((s) => s.theme);
  const largerText = usePreferences((s) => s.largerText);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => root.classList.toggle("dark", resolveDark(theme));
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mq.removeEventListener("change", apply);
      observer.disconnect();
    };
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.fontSize = largerText ? "112.5%" : "";
  }, [largerText]);

  return null;
}
