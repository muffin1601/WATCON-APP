"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type WorkspaceTab = { key: string; label: string; count?: number; badge?: string };
export type WorkspaceGroup = { key: string; label: string; tabs: WorkspaceTab[] };

/**
 * Two-level project navigation: a short row of areas (Overview, Sales, Materials, Site & stores,
 * Accounts, Records) and, under the active area, its tabs. State lives in `?tab=` so every view
 * is a shareable link and works without client state.
 */
export function WorkspaceTabs({ groups, current }: { groups: WorkspaceGroup[]; current: string }) {
  const pathname = usePathname();
  const href = (tab: string) => (tab === "overview" ? pathname : `${pathname}?tab=${tab}`);
  const active = groups.find((g) => g.tabs.some((t) => t.key === current)) ?? groups[0]!;
  return (
    <nav aria-label="Project sections" className="mb-5 space-y-2">
      <div role="tablist" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {groups.map((g) => {
          const on = g.key === active.key;
          const total = g.tabs.reduce((a, t) => a + (t.count ?? 0), 0);
          const attention = g.tabs.some((t) => t.badge);
          return (
            <Link
              key={g.key}
              role="tab"
              aria-selected={on}
              href={href(g.tabs[0]!.key)}
              scroll={false}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {g.label}
              {g.key !== "overview" && total > 0 && <span className={cn("rounded-full px-1.5 text-xs tabular-nums", on ? "bg-primary-foreground/20" : "bg-muted")}>{total}</span>}
              {attention && <span className="size-2 rounded-full bg-amber-500" aria-label="needs attention" />}
            </Link>
          );
        })}
      </div>
      {active.tabs.length > 1 && (
        <div role="tablist" aria-label={active.label} className="flex gap-1 overflow-x-auto border-b">
          {active.tabs.map((t) => {
            const on = current === t.key;
            return (
              <Link
                key={t.key}
                role="tab"
                aria-selected={on}
                href={href(t.key)}
                scroll={false}
                className={cn("-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors", on ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
              >
                {t.label}
                {t.count !== undefined && <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{t.count}</span>}
                {t.badge && <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 text-[11px] text-amber-800">{t.badge}</span>}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
