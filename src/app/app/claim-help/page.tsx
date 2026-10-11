import type { Metadata } from "next";
import { ClaimHelp } from "@/features/claim-help/claim-help";

export const metadata: Metadata = { title: "Claim help" };

export default function Page() {
  return <ClaimHelp />;
}
