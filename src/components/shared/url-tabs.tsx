"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Tabs whose state lives in the `tab` URL parameter (server-rendered content, shareable links). */
export function UrlTabs({ tabs, current }: { tabs: { key: string; label: string; count?: number }[]; current: string }) {
  const pathname = usePathname();
  return (
    <div role="tablist" className="mb-5 flex gap-1 overflow-x-auto border-b">
      {tabs.map((t) => {
        const qs = new URLSearchParams();
        if (t.key !== tabs[0]!.key) qs.set("tab", t.key);
        const active = current === t.key;
        return (
          <Link
            key={t.key}
            role="tab"
            aria-selected={active}
            href={qs.size ? `${pathname}?${qs}` : pathname}
            scroll={false}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{t.count}</span>}
          </Link>
        );
      })}
    </div>
  );
}
