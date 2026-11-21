import { Link2 } from "lucide-react";
import Link from "next/link";
import { DocStatusBadge } from "./ui";

export type RelatedDoc = { type: string; id: string; number: string; status?: string; href: string; meta?: string };

/** Every document relationship, navigable in both directions. */
export function RelatedDocs({ docs, title = "Related documents" }: { docs: RelatedDoc[]; title?: string }) {
  return (
    <section className="rounded-xl border bg-card" aria-label={title}>
      <h2 className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold">
        <Link2 className="size-4 text-muted-foreground" /> {title}
      </h2>
      {docs.length === 0 ? (
        <p className="px-4 py-5 text-center text-sm text-muted-foreground">No linked documents yet.</p>
      ) : (
        <ul className="divide-y">
          {docs.map((d) => (
            <li key={`${d.type}-${d.id}`} className="flex items-center gap-2 px-4 py-2 text-sm">
              <span className="w-28 shrink-0 text-xs text-muted-foreground">{d.type}</span>
              <Link href={d.href} className="font-medium hover:text-primary hover:underline">
                {d.number}
              </Link>
              {d.meta && <span className="truncate text-xs text-muted-foreground">{d.meta}</span>}
              {d.status && <DocStatusBadge status={d.status} className="ml-auto" />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
