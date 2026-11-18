import "server-only";
import { notFound } from "next/navigation";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

/**
 * Page helper: renders the 404 page when a record is missing OR not visible to the
 * user (never reveals whether an unauthorized record exists).
 */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (e) {
    if (e instanceof NotFoundError || e instanceof ForbiddenError) notFound();
    throw e;
  }
}

export type SearchParams = Record<string, string | string[] | undefined>;

/** Flattens Next's searchParams into a query string (first value of repeated keys). */
export function toQueryString(params: SearchParams, omit: string[] = []): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (omit.includes(k)) continue;
    const value = Array.isArray(v) ? v[0] : v;
    if (value) qs.set(k, value);
  }
  return qs.toString();
}
