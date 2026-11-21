import { ArrowRight, FileText, Plus } from "lucide-react";
import Link from "next/link";
import { DOC_STATUS, DocStatusBadge, Money } from "@/components/commercial/ui";
import { EmptyState } from "@/components/shared/states";
import { FilterBar, FilterSelect, SearchInput } from "@/components/tables/filters";
import { Pagination } from "@/components/tables/pagination";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type DocListRow = { id: string; number: string; href: string; date: string | null; title: string | null; party: string | null; status: string; amount: string | null; secondary: string | null; overdue: boolean };

const statusLabel = (s: string) => DOC_STATUS[s]?.label ?? s.replace(/_/g, " ").toLowerCase();

/**
 * Responsive document list used by every project tab: search + status filter, a card list on
 * phones and a table from `md` up, pagination. Every row opens its document; the header offers
 * the "New …" action pre-linked to the project.
 */
export function DocList({
  title,
  about,
  rows,
  total,
  page,
  pageSize,
  statuses,
  filtered,
  newHref,
  newLabel,
  allHref,
  showAmount = true,
  searchPlaceholder = "Search number or party…",
}: {
  title: string;
  about: string;
  rows: DocListRow[];
  total: number;
  page: number;
  pageSize: number;
  statuses: string[];
  filtered: boolean;
  newHref?: string | null;
  newLabel?: string | null;
  allHref?: string;
  showAmount?: boolean;
  searchPlaceholder?: string;
}) {
  const action =
    newHref && newLabel ? (
      <Button asChild size="sm">
        <Link href={newHref}>
          <Plus /> {newLabel}
        </Link>
      </Button>
    ) : null;
  const empty = total === 0 && !filtered;
  return (
    <section aria-label={title} className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">{about}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {allHref && !empty && (
            <Button asChild size="sm" variant="outline">
              <Link href={allHref}>
                Open module <ArrowRight />
              </Link>
            </Button>
          )}
          {action}
        </div>
      </div>
      {empty ? (
        <EmptyState icon={FileText} title={`No ${title.toLowerCase()} yet`} description={about} action={action ?? undefined} />
      ) : (
        <>
          <FilterBar params={["q", "status"]} className="mb-0">
            <SearchInput placeholder={searchPlaceholder} />
            <FilterSelect param="status" label="Status" options={statuses.map((s) => ({ value: s, label: statusLabel(s) }))} />
          </FilterBar>
          {rows.length === 0 ? (
            <p className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Nothing matches these filters.</p>
          ) : (
            <>
              <ul className="divide-y rounded-xl border bg-card md:hidden">
                {rows.map((r) => (
                  <li key={r.id}>
                    <Link href={r.href} className="block px-4 py-3 hover:bg-muted/40">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{r.number}</span>
                        <DocStatusBadge status={r.status} />
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-sm text-muted-foreground">
                        <span className="truncate">{r.party ?? r.title ?? "—"}</span>
                        {showAmount && r.amount && <Money value={r.amount} className="text-foreground" />}
                      </div>
                      <div className={cn("mt-0.5 text-xs text-muted-foreground", r.overdue && "font-medium text-rose-700")}>
                        {formatDate(r.date)}
                        {r.secondary ? ` · ${r.secondary}` : ""}
                        {r.overdue ? " · overdue" : ""}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Number</th>
                      <th className="px-3 py-2 text-left font-medium">Date</th>
                      <th className="px-3 py-2 text-left font-medium">Details</th>
                      {showAmount && <th className="px-3 py-2 text-right font-medium">Amount</th>}
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((r) => (
                      <tr key={r.id} className="relative hover:bg-muted/30">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Link href={r.href} className="font-medium after:absolute after:inset-0 hover:text-primary hover:underline">
                            {r.number}
                          </Link>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.date)}</td>
                        <td className="max-w-md px-3 py-2">
                          <div className="truncate">{[r.party, r.title].filter(Boolean).join(" · ") || "—"}</div>
                          {(r.secondary || r.overdue) && <div className={cn("truncate text-xs text-muted-foreground", r.overdue && "font-medium text-rose-700")}>{[r.secondary, r.overdue ? "Overdue" : null].filter(Boolean).join(" · ")}</div>}
                        </td>
                        {showAmount && <td className="px-3 py-2 text-right">{r.amount ? <Money value={r.amount} /> : <span className="text-muted-foreground">—</span>}</td>}
                        <td className="px-3 py-2">
                          <DocStatusBadge status={r.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <Pagination total={total} page={page} pageSize={pageSize} />
        </>
      )}
    </section>
  );
}
