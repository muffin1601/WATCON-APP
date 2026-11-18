"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryParams } from "@/hooks/use-query-params";
import { cn } from "@/lib/utils";

/** Debounced search box bound to a URL parameter (default `q`). */
export function SearchInput({ param = "q", placeholder = "Search…", className }: { param?: string; placeholder?: string; className?: string }) {
  const { get, setParams } = useQueryParams();
  const urlValue = get(param);
  const [value, setValue] = useState(urlValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushed = useRef(urlValue);

  // Keep the box in sync when the URL changes externally (e.g. "Clear filters").
  useEffect(() => {
    if (urlValue !== lastPushed.current) {
      lastPushed.current = urlValue;
      setValue(urlValue);
    }
  }, [urlValue]);

  function onChange(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      lastPushed.current = next.trim();
      setParams({ [param]: next.trim() || null });
    }, 350);
  }

  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 bg-card pl-8" aria-label={placeholder} />
    </div>
  );
}

export type Option = { value: string; label: string };

/** Single-value select bound to a URL parameter. */
export function FilterSelect({ param, label, options, allLabel = "All", className }: { param: string; label: string; options: Option[]; allLabel?: string; className?: string }) {
  const { get, setParams } = useQueryParams();
  const value = get(param) || "__all";
  return (
    <Select value={value} onValueChange={(v) => setParams({ [param]: v === "__all" ? null : v })}>
      <SelectTrigger className={cn("h-9 w-full bg-card sm:w-44", className)} aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">
          {label}: {allLabel}
        </SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** From / to date inputs bound to two URL parameters. */
export function DateRangeFilter({ fromParam, toParam, label }: { fromParam: string; toParam: string; label: string }) {
  const { get, setParams } = useQueryParams();
  return (
    <fieldset className="flex w-full items-center gap-1.5 sm:w-auto">
      <legend className="sr-only">{label}</legend>
      <span className="w-14 shrink-0 text-xs whitespace-nowrap text-muted-foreground sm:w-auto">{label}</span>
      <Input type="date" value={get(fromParam)} onChange={(e) => setParams({ [fromParam]: e.target.value || null })} className="h-9 min-w-0 flex-1 bg-card sm:w-[9.5rem] sm:flex-none" aria-label={`${label} from`} />
      <span className="text-xs text-muted-foreground">–</span>
      <Input type="date" value={get(toParam)} onChange={(e) => setParams({ [toParam]: e.target.value || null })} className="h-9 min-w-0 flex-1 bg-card sm:w-[9.5rem] sm:flex-none" aria-label={`${label} to`} />
    </fieldset>
  );
}

/** Wrapper row for filters, with a "Clear" button when any of `params` is set. */
export function FilterBar({ children, params, className }: { children: ReactNode; params: string[]; className?: string }) {
  const { get, setParams } = useQueryParams();
  const active = params.some((p) => get(p));
  return (
    <div className={cn("mb-4 flex flex-col flex-wrap gap-2 sm:flex-row sm:items-center", className)}>
      {children}
      {active && (
        <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={() => setParams(Object.fromEntries(params.map((p) => [p, null])))}>
          <X className="size-3.5" /> Clear filters
        </Button>
      )}
    </div>
  );
}
