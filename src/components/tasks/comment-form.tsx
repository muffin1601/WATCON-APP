"use client";

import { callAction } from "@/lib/call-action";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addCommentAction } from "@/modules/tasks/actions";

export function CommentForm({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await callAction(addCommentAction, { taskId, body });
    setBusy(false);
    if (!res.ok) {
      setError(res.fieldErrors?.body ?? res.error);
      return;
    }
    setBody("");
    toast.success("Comment added");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor="comment-body" className="sr-only">
        Add a comment
      </label>
      <Textarea
        id="comment-body"
        rows={3}
        maxLength={4000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a comment or site update…"
        aria-invalid={!!error}
        aria-describedby={error ? "comment-body-error" : undefined}
      />
      {error && (
        <p id="comment-body-error" role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={busy || !body.trim()}>
          {busy && <Loader2 className="animate-spin" />} Add comment
        </Button>
      </div>
    </form>
  );
}
