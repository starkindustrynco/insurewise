import type { Metadata } from "next";
import { Landing } from "@/features/landing/landing";

export const metadata: Metadata = { title: "Know what your health policy covers" };

export default function Page() {
  return <Landing />;
}
