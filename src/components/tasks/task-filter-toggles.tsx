"use client";

import { AlertTriangle, CalendarRange, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useQueryParams } from "@/hooks/use-query-params";
import { cn } from "@/lib/utils";

function Toggle({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: ReactNode; label: string }) {
  return (
    <Button type="button" variant="outline" size="sm" aria-pressed={active} aria-label={label} onClick={onClick} className={cn("h-9 bg-card", active && "border-primary/40 bg-primary/8 text-primary hover:bg-primary/10 hover:text-primary")}>
      {children}
    </Button>
  );
}

/** Boolean URL flag toggle (e.g. overdue=1, mine=1). */
export function FlagToggle({ param, label, icon }: { param: string; label: string; icon: "overdue" | "mine" }) {
  const { get, setParams } = useQueryParams();
  const active = get(param) === "1";
  const Icon = icon === "overdue" ? AlertTriangle : UserRound;
  return (
    <Toggle active={active} label={label} onClick={() => setParams({ [param]: active ? null : "1" })}>
      <Icon /> {label}
    </Toggle>
  );
}

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Sets dueFrom/dueTo to the current calendar month (toggles off when already applied). */
export function DueThisMonthToggle() {
  const { get, setParams } = useQueryParams();
  const now = new Date();
  const from = isoDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = isoDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const active = get("dueFrom") === from && get("dueTo") === to;
  return (
    <Toggle active={active} label="Due this month" onClick={() => setParams(active ? { dueFrom: null, dueTo: null } : { dueFrom: from, dueTo: to })}>
      <CalendarRange /> Due this month
    </Toggle>
  );
}
