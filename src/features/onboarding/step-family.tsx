"use client";

import { useState } from "react";
import { Plus, Trash, UsersThree } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Member, Relation } from "@/domain/types";
import { newId } from "@/store/app-store";
import { cn } from "@/lib/utils/cn";

export const RELATIONS: { value: Relation; label: string }[] = [
  { value: "spouse", label: "Spouse" },
  { value: "child", label: "Child" },
  { value: "parent", label: "Parent" },
  { value: "parent-in-law", label: "Parent-in-law" },
  { value: "sibling", label: "Sibling" },
];

export const RELATION_LABEL: Record<Relation, string> = {
  self: "You",
  spouse: "Spouse",
  child: "Child",
  parent: "Parent",
  "parent-in-law": "Parent-in-law",
  sibling: "Sibling",
  other: "Family",
};

interface Draft {
  id: string;
  name: string;
  relation: Relation;
  age: string;
}

const toDraft = (m: Member): Draft => ({ id: m.id, name: m.name, relation: m.relation, age: String(m.age) });

/** You and your family on one screen. Only name, relation and age: no medical details. */
export function StepFamily({ initial, onDone }: { initial: Member[]; onDone: (members: Member[]) => void }) {
  const self = initial.find((m) => m.relation === "self");
  const [me, setMe] = useState<Draft>(self ? toDraft(self) : { id: newId("mem"), name: "", relation: "self", age: "" });
  const [others, setOthers] = useState<Draft[]>(initial.filter((m) => m.relation !== "self").map(toDraft));
  const [tried, setTried] = useState(false);

  const validAge = (a: string) => /^\d{1,3}$/.test(a) && Number(a) <= 110;
  const valid = (d: Draft) => d.name.trim().length >= 2 && validAge(d.age);
  const allValid = valid(me) && others.every(valid);

  const add = (relation: Relation) => setOthers((o) => [...o, { id: newId("mem"), name: "", relation, age: "" }]);

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (!allValid) return;
        onDone([me, ...others].map((d) => ({ id: d.id, name: d.name.trim(), relation: d.relation, age: Number(d.age) })));
      }}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-title">Your family</h1>
        <p className="text-muted-foreground">Some policy rules depend on age, so we only ask names and ages. No medical details.</p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-medium">About you</legend>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="me-name">Your name</Label>
            <Input
              id="me-name"
              autoComplete="name"
              value={me.name}
              onChange={(e) => setMe({ ...me, name: e.target.value })}
              aria-invalid={tried && me.name.trim().length < 2}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="me-age">Age</Label>
            <Input
              id="me-age"
              inputMode="numeric"
              value={me.age}
              onChange={(e) => setMe({ ...me, age: e.target.value.replace(/\D/g, "").slice(0, 3) })}
              aria-invalid={tried && !validAge(me.age)}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-medium">Who else is in your family?</legend>
        {others.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl border border-dashed border-border-strong px-4 py-3 text-support text-muted-foreground">
            <UsersThree className="size-5" aria-hidden /> Just you for now. Add anyone your policy covers.
          </p>
        ) : null}
        {others.map((d, i) => (
          <div key={d.id} className="surface-card flex flex-col gap-3 p-3">
            <div className="flex items-center justify-between">
              <span className="text-support font-medium text-muted-foreground">{RELATION_LABEL[d.relation]}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${d.name || RELATION_LABEL[d.relation]}`}
                onClick={() => setOthers((o) => o.filter((x) => x.id !== d.id))}
              >
                <Trash aria-hidden />
              </Button>
            </div>
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <Input
                aria-label={`${RELATION_LABEL[d.relation]} name`}
                placeholder="Name"
                value={d.name}
                onChange={(e) => setOthers((o) => o.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                aria-invalid={tried && d.name.trim().length < 2}
              />
              <Input
                aria-label={`${RELATION_LABEL[d.relation]} age`}
                placeholder="Age"
                inputMode="numeric"
                value={d.age}
                onChange={(e) => setOthers((o) => o.map((x, j) => (j === i ? { ...x, age: e.target.value.replace(/\D/g, "").slice(0, 3) } : x)))}
                aria-invalid={tried && !validAge(d.age)}
              />
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {RELATIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => add(r.value)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 text-[0.875rem] font-medium transition-colors hover:border-border-strong hover:bg-surface-muted",
              )}
            >
              <Plus className="size-4" aria-hidden /> {r.label}
            </button>
          ))}
        </div>
      </fieldset>

      {tried && !allValid ? (
        <p role="alert" className="text-support text-danger-foreground">
          Add a name and an age for everyone.
        </p>
      ) : null}

      <Button type="submit" size="lg" block>
        Continue
      </Button>
    </form>
  );
}
