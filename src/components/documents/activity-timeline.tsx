import { History } from "lucide-react";
import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { entityHref } from "@/modules/documents/links";

type Item = { id: string; at: string; actor: string; summary: string; action: string; entityType?: string; entityId?: string | null };

/** Read-only audit timeline. Entries are append-only and cannot be edited from the app. */
export function ActivityTimeline({ items, title = "Activity & audit history", linkEntities = false }: { items: Item[]; title?: string; linkEntities?: boolean }) {
  return (
    <section className="rounded-xl border bg-card" aria-label={title}>
      <h2 className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold">
        <History className="size-4 text-muted-foreground" /> {title}
      </h2>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
      ) : (
        <ol className="divide-y">
          {items.map((a) => {
            const href = linkEntities && a.entityType && a.entityId ? entityHref(a.entityType, a.entityId) : null;
            return (
              <li key={a.id} className="flex flex-col gap-0.5 px-4 py-2.5 text-sm sm:flex-row sm:gap-3">
                <span className="w-40 shrink-0 text-xs text-muted-foreground tabular-nums">{formatDateTime(a.at)}</span>
                <span className="shrink-0 font-medium">{a.actor}</span>
                {href ? (
                  <Link href={href} className="text-muted-foreground hover:text-foreground hover:underline">
                    {a.summary}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{a.summary}</span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
