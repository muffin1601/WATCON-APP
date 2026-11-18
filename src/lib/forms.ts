"use client";

import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/errors";

/**
 * Applies a server ActionResult to a react-hook-form instance: field errors are
 * mapped onto fields, other errors become a toast. Returns true on success.
 */
export function applyActionResult<T extends FieldValues, R>(result: ActionResult<R>, setError?: UseFormSetError<T>, successMessage?: string): result is { ok: true; data: R } {
  if (result.ok) {
    if (successMessage) toast.success(successMessage);
    return true;
  }
  if (result.code === "UNAUTHENTICATED") {
    toast.error("Your session has expired. Please sign in again.");
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- hard reload intentionally drops client state after the session is gone
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    return false;
  }
  let mapped = false;
  if (result.fieldErrors && setError) {
    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (field === "_form") continue;
      setError(field as Path<T>, { type: "server", message });
      mapped = true;
    }
  }
  toast.error(mapped ? result.error : result.error);
  return false;
}
