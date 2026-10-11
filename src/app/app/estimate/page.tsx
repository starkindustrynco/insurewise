import type { Metadata } from "next";
import { Estimate } from "@/features/estimate/estimate";

export const metadata: Metadata = { title: "Estimate" };

export default function Page() {
  return <Estimate />;
}
