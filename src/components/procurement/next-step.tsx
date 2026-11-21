import { ArrowRight, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type NextStepTone = "info" | "action" | "done" | "warn";

const TONES: Record<NextStepTone, { box: string; icon: typeof Info }> = {
  info: { box: "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100", icon: Info },
  action: { box: "border-primary/30 bg-primary/5", icon: ArrowRight },
  done: { box: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100", icon: CheckCircle2 },
  warn: { box: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100", icon: TriangleAlert },
};

/** "For project X · Sales order Y" — the chain every procurement document belongs to. */
export function ProjectTrace({ project, salesOrders = [], tab }: { project: { id: string; code: string; name: string } | null; salesOrders?: { id: string; number: string }[]; tab?: string }) {
  if (!project) return null;
  return (
    <span className="text-sm text-muted-foreground">
      For project{" "}
      <Link href={`/projects/${project.id}${tab ? `?tab=${tab}` : ""}`} className="font-medium text-primary hover:underline">
        {project.code} – {project.name}
      </Link>
      {salesOrders.map((s) => (
        <span key={s.id}>
          {" · "}Sales order{" "}
          <Link href={`/sales-orders/${s.id}`} className="font-medium text-primary hover:underline">
            {s.number}
          </Link>
        </span>
      ))}
    </span>
  );
}

/** Plain-language "where is this document and what happens next" banner shown on detail pages. */
export function NextStep({ tone = "action", title, children, links = [] }: { tone?: NextStepTone; title: string; children?: ReactNode; links?: { href: string; label: string }[] }) {
  const t = TONES[tone];
  const Icon = t.icon;
  return (
    <div role="status" className={cn("mb-4 flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center", t.box)}>
      <Icon className="size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">{title}</p>
        {children && <div className="mt-0.5 opacity-90">{children}</div>}
      </div>
      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="inline-flex h-8 items-center gap-1 rounded-md border bg-background px-3 text-sm font-medium text-foreground hover:bg-accent">
              {l.label} <ArrowRight className="size-3.5" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
