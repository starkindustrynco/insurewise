import type { Metadata } from "next";
import { AdvisorDesk } from "@/features/portals/advisor-desk";

export const metadata: Metadata = { title: "Advisor view (demo)" };

export default function Page() {
  return <AdvisorDesk />;
}
