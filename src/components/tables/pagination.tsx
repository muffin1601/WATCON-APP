"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryParams } from "@/hooks/use-query-params";

export function Pagination({ total, page, pageSize }: { total: number; page: number; pageSize: number }) {
  const { setParams } = useQueryParams();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="mt-3 flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground sm:flex-row">
      <span aria-live="polite">
        {total === 0 ? "No records" : `Showing ${from}–${to} of ${total}`}
      </span>
      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(v) => setParams({ pageSize: v })}>
          <SelectTrigger size="sm" className="h-8 w-[7.5rem] bg-card" aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 20, 25, 50, 100].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) })} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <span className="min-w-16 text-center tabular-nums">
          {page} / {pages}
        </span>
        <Button variant="outline" size="icon-sm" disabled={page >= pages} onClick={() => setParams({ page: String(page + 1) })} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
