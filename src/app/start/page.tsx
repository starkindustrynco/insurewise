import type { Metadata } from "next";
import { StartFlow } from "@/features/onboarding/start-flow";

export const metadata: Metadata = { title: "Get started" };

export default function Page() {
  return <StartFlow />;
}
