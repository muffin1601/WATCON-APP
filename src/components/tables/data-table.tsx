"use client";

import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQueryParams } from "@/hooks/use-query-params";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = ColumnDef<T> & {
  /** URL `sort` key; when set the header becomes a server-side sort toggle. */
  sortKey?: string;
  className?: string;
};

/**
 * Server-driven data table: rows arrive already filtered, sorted and paginated by
 * the server. Sorting headers update the `sort` / `dir` URL parameters.
 */
export function DataTable<T>({ columns, data, empty, getRowId, defaultSort, defaultDir = "asc" }: { columns: DataTableColumn<T>[]; data: T[]; empty?: ReactNode; getRowId?: (row: T) => string; defaultSort?: string; defaultDir?: "asc" | "desc" }) {
  const { get, setParams, isPending } = useQueryParams();
  const sort = get("sort") || defaultSort;
  const dir = (get("dir") || defaultDir) as "asc" | "desc";

  // TanStack Table is not React-Compiler compatible; the compiler skips this component (expected).
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
  });

  if (!data.length && empty) return <>{empty}</>;

  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card transition-opacity", isPending && "opacity-60")}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-muted/40 hover:bg-muted/40">
                {hg.headers.map((header) => {
                  const col = header.column.columnDef as DataTableColumn<T>;
                  const active = col.sortKey && sort === col.sortKey;
                  return (
                    <TableHead key={header.id} className={cn("h-10 text-xs font-medium whitespace-nowrap text-muted-foreground", col.className)} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}>
                      {col.sortKey ? (
                        <button
                          type="button"
                          className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                          onClick={() => setParams({ sort: col.sortKey, dir: active && dir === "asc" ? "desc" : "asc" })}
                        >
                          {flexRender(col.header, header.getContext())}
                          {active ? dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                        </button>
                      ) : header.isPlaceholder ? null : (
                        flexRender(col.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cn("py-2.5 align-middle", (cell.column.columnDef as DataTableColumn<T>).className)}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
