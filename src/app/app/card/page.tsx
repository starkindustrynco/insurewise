import { Suspense } from "react";
import type { Metadata } from "next";
import { MemberCard } from "@/features/card/member-card";

export const metadata: Metadata = { title: "Hospital-ready card" };

export default function Page() {
  return (
    <Suspense>
      <MemberCard />
    </Suspense>
  );
}
