import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import samplePages from "./fixtures-sample-pages.json";
import { CardRail } from "@/features/card/card-rail";
import { sampleRead } from "@/domain/samples";
import { toPolicy } from "@/lib/intake";
import { useApp } from "@/store/app-store";
import type { Member } from "@/domain/types";

const members: Member[] = [
  { id: "m1", name: "Meera Raghavan", relation: "self", age: 38 },
  { id: "m2", name: "Ravi Raghavan", relation: "spouse", age: 40 },
  { id: "m3", name: "Lakshmi Narayanan", relation: "parent", age: 64 },
];

function seed(memberIds: string[]) {
  const base = toPolicy({ result: sampleRead(3), live: false }, [{ name: "lotus.pdf", pages: samplePages as string[], size: 1 }], members);
  const policy = { ...base, memberIds };
  useApp.setState({ members, policies: [policy], activePolicyId: policy.id, onboarded: true });
}

describe("Hospital card side panel", () => {
  it("shows only the people the policy covers, and switches cards", () => {
    seed(["m1", "m3"]);
    render(<CardRail />);
    expect(screen.getByRole("heading", { name: "Hospital-ready cards" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Meera" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Ravi" })).toBeNull();
    expect(screen.getByRole("article", { name: "Hospital-ready card for Meera Raghavan" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lakshmi" }));
    const card = screen.getByRole("article", { name: "Hospital-ready card for Lakshmi Narayanan" });
    expect(card).toHaveTextContent("10% of each claim");
    expect(screen.getByRole("link", { name: /Papers to carry/ })).toHaveAttribute("href", "/app/card?member=m3");
  });

  it("asks for a policy when there isn't one", () => {
    useApp.setState({ members, policies: [], activePolicyId: null, onboarded: true });
    render(<CardRail />);
    expect(screen.getByRole("link", { name: "Add a policy" })).toHaveAttribute("href", "/app/add");
  });
});
