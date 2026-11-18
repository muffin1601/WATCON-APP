"use client";

import { callAction } from "@/lib/call-action";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addStatusUpdateAction } from "@/modules/projects/actions";

/** Posts a new status paragraph. Previous paragraphs are kept as history (never overwritten). */
export function StatusUpdateForm({ projectId, onDone }: { projectId: string; onDone?: () => void }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await callAction(addStatusUpdateAction, { projectId, body });
    setBusy(false);
    if (!res.ok) {
      setError(res.fieldErrors?.body ?? res.error);
      return;
    }
    toast.success("Status update saved");
    setBody("");
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor="status-body" className="sr-only">
        New status update
      </label>
      <Textarea
        id="status-body"
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="e.g. Electrical installation is currently in progress. Civil work for the second floor is completed. Material procurement is pending supplier confirmation."
        aria-invalid={!!error}
        aria-describedby={error ? "status-body-error" : undefined}
        maxLength={5000}
      />
      {error && (
        <p id="status-body-error" role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Saving adds a new entry; earlier updates stay in Status History.</span>
        <Button type="submit" size="sm" disabled={busy || body.trim().length < 3}>
          {busy && <Loader2 className="animate-spin" />} Save update
        </Button>
      </div>
    </form>
  );
}
