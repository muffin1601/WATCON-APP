"use client";

import { callAction } from "@/lib/call-action";
import { Gauge, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/shared/dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TASK_STATUS_LABELS } from "@/lib/format";
import { updateTaskProgressAction } from "@/modules/tasks/actions";

function ProgressForm({ taskId, version, status: initialStatus, progress: initialProgress, canCancel, close }: { taskId: string; version: number; status: string; progress: number; canCancel: boolean; close: () => void }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [progress, setProgress] = useState(String(initialProgress));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statuses = Object.entries(TASK_STATUS_LABELS).filter(([k]) => canCancel || k !== "CANCELLED");
  const reopening = initialStatus === "COMPLETED" && status !== "COMPLETED";

  function onStatus(v: string) {
    setStatus(v);
    if (v === "COMPLETED") setProgress("100");
    else if (v === "TODO") setProgress("0");
    else if (initialStatus === "COMPLETED" && Number(progress) === 100) setProgress("90");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(progress);
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      setError("Progress must be a whole number between 0 and 100.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await callAction(updateTaskProgressAction, { taskId, version, status, progress: value });
    setBusy(false);
    if (!res.ok) {
      if (res.code === "CONFLICT") {
        toast.error(res.error, { action: { label: "Reload", onClick: () => router.refresh() }, duration: 10000 });
        close();
        return;
      }
      setError(res.fieldErrors?.progress ?? res.fieldErrors?.status ?? res.error);
      return;
    }
    toast.success(`Updated: ${TASK_STATUS_LABELS[res.data.status] ?? res.data.status} · ${res.data.progress}%`);
    close();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field id="pd-status" label="Status">
        <Select value={status} onValueChange={onStatus}>
          <SelectTrigger id="pd-status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field id="pd-progress" label="Progress (%)" error={error ?? undefined} help={reopening ? "Reopening a completed task: choose a progress value below 100%." : "Setting 100% marks the task Completed. To Do tasks are at 0%."}>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Number(progress) || 0}
            onChange={(e) => setProgress(e.target.value)}
            className="w-full accent-[var(--primary)]"
            aria-label="Progress slider"
          />
          <Input id="pd-progress" type="number" inputMode="numeric" min={0} max={100} value={progress} onChange={(e) => setProgress(e.target.value)} className="w-20" aria-invalid={!!error} />
        </div>
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={close}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Save
        </Button>
      </div>
    </form>
  );
}

/** Status / progress update for managers and the task's own assignees. */
export function ProgressDialog(props: { taskId: string; version: number; status: string; progress: number; canCancel: boolean }) {
  return (
    <FormDialog
      title="Update progress"
      description="Changes are recorded in the task's activity history."
      trigger={
        <Button size="sm">
          <Gauge /> Update progress
        </Button>
      }
    >
      {(close) => <ProgressForm {...props} close={close} />}
    </FormDialog>
  );
}
