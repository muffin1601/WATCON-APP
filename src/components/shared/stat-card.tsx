import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function StatCard({ label, value, icon: Icon, href, tone = "default", hint }: { label: string; value: number | string; icon?: LucideIcon; href?: string; tone?: "default" | "danger" | "success" | "info"; hint?: string }) {
  const body = (
    <div className={cn("group flex h-full flex-col justify-between gap-3 rounded-xl border bg-card p-4 transition-colors", href && "hover:border-primary/30 hover:bg-accent/40")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <span className={cn("flex size-7 items-center justify-center rounded-md", tone === "danger" ? "bg-red-50 text-red-600" : tone === "success" ? "bg-emerald-50 text-emerald-600" : tone === "info" ? "bg-blue-50 text-blue-600" : "bg-muted text-muted-foreground")}>
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      <div>
        <div className={cn("text-2xl font-semibold tabular-nums tracking-tight", tone === "danger" && Number(value) > 0 && "text-red-600")}>{value}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}
