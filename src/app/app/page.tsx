import type { Metadata } from "next";
import { MyCover } from "@/features/cover/my-cover";

export const metadata: Metadata = { title: "My cover" };

export default function Page() {
  return <MyCover />;
}
