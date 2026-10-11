import { Suspense } from "react";
import type { Metadata } from "next";
import { Ask } from "@/features/ask/ask";

export const metadata: Metadata = { title: "Ask" };

export default function Page() {
  return (
    <Suspense>
      <Ask />
    </Suspense>
  );
}
