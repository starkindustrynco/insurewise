import { Suspense } from "react";
import type { Metadata } from "next";
import { AddPolicy } from "@/features/intake/add-policy";

export const metadata: Metadata = { title: "Add a policy" };

export default function Page() {
  return (
    <Suspense>
      <AddPolicy />
    </Suspense>
  );
}
