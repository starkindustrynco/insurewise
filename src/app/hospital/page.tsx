import { Suspense } from "react";
import type { Metadata } from "next";
import { HospitalDesk } from "@/features/portals/hospital-desk";

export const metadata: Metadata = { title: "Hospital desk (demo)" };

export default function Page() {
  return (
    <Suspense>
      <HospitalDesk />
    </Suspense>
  );
}
