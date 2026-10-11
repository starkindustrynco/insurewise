"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ChatCircleText, Calculator, FileMagnifyingGlass, ShieldCheck } from "@phosphor-icons/react";
import { Logo } from "@/components/brand/logo";
import { useApp } from "@/store/app-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils/cn";

const TABS = [
  { href: "/app", label: "My cover", icon: ShieldCheck },
  { href: "/app/ask", label: "Ask", icon: ChatCircleText },
  { href: "/app/estimate", label: "Estimate", icon: Calculator },
  { href: "/app/claim-help", label: "Claim help", icon: FileMagnifyingGlass },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useHydrated();
  const onboarded = useApp((s) => s.onboarded);
  const me = useApp((s) => s.members.find((m) => m.relation === "self"));

  useEffect(() => {
    if (hydrated && !onboarded) router.replace("/start");
  }, [hydrated, onboarded, router]);

  const active = (href: string) => (href === "/app" ? pathname === "/app" || pathname.startsWith("/app/card") : pathname.startsWith(href));

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md" style={{ paddingTop: "var(--safe-top)" }}>
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href="/app" aria-label="My cover">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active(t.href) ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[0.875rem] font-medium transition-colors",
                  active(t.href)
                    ? "bg-accent-soft text-accent-soft-foreground"
                    : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/app/profile"
            aria-label="Profile and settings"
            className="grid size-9 place-items-center rounded-full bg-primary text-[0.85rem] font-semibold text-primary-foreground"
          >
            {hydrated && me ? me.name.slice(0, 1).toUpperCase() : ""}
          </Link>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-2xl px-4 pb-28 pt-5 md:pb-12">
        {hydrated && onboarded ? children : null}
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: "var(--safe-bottom)" }}
      >
        <ul className="mx-auto grid max-w-2xl grid-cols-4">
          {TABS.map((t) => {
            const Icon = t.icon;
            const on = active(t.href);
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[0.72rem] font-medium",
                    on ? "text-accent-strong" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-6" weight={on ? "fill" : "regular"} aria-hidden />
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
