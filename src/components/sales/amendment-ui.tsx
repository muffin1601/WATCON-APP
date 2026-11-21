"use client";

import { Check, GitPullRequestArrow, Undo2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ToneBadge } from "@/components/commercial/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { callAction } from "@/lib/call-action";
import { formatDateTime } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { decideSoAmendmentAction, withdrawSoAmendmentAction } from "@/modules/sales/actions";
import { computeDiff } from "./so-form";

type Line = { id?: string | null; itemBrandId?: string | null; description?: string | null; quantity: string; rate: string; gstRate: string; unit?: string | null };
export type AmendmentView = {
  id: string;
  requestNo: number;
  status: string;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  appliedRevision: number | null;
  beforeTotal: string;
  afterTotal: string;
  before: Line[];
  after: Line[];
};

const TONE: Record<string, "warn" | "good" | "bad" | "muted"> = { PENDING: "warn", APPROVED: "good", REJECTED: "bad", WITHDRAWN: "muted" };
const LABEL: Record<string, string> = { PENDING: "Awaiting Super Admin", APPROVED: "Approved", REJECTED: "Rejected", WITHDRAWN: "Withdrawn" };

function DiffList({ before, after }: { before: Line[]; after: Line[] }) {
  const d = computeDiff(before, after);
  if (!d.length) return <p className="text-xs text-muted-foreground">Header / terms changes only.</p>;
  return (
    <ul className="space-y-1 text-sm">
      {d.map((x, i) => (
        <li key={i} className={cn("rounded-md px-2 py-1", x.kind === "added" ? "bg-emerald-50 text-emerald-900" : x.kind === "removed" ? "bg-rose-50 text-rose-900" : "bg-amber-50 text-amber-900")}>{x.text}</li>
      ))}
    </ul>
  );
}

/** Banner for a pending request: Super Admins decide, the requester can withdraw. */
export function PendingAmendment({ request, canDecide, canWithdraw }: { request: AmendmentView; canDecide: boolean; canWithdraw: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  async function run(kind: "approve" | "reject" | "withdraw") {
    if (kind === "reject" && !note.trim()) {
      toast.error("Write a reason for rejecting.");
      return;
    }
    setBusy(kind);
    const res = kind === "withdraw" ? await callAction(withdrawSoAmendmentAction, request.id) : await callAction(decideSoAmendmentAction, request.id, kind, note.trim() || null);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(kind === "approve" ? "Amendment approved and applied." : kind === "reject" ? "Amendment rejected." : "Request withdrawn.");
    router.refresh();
  }
  return (
    <section className="mb-4 space-y-3 rounded-xl border border-amber-300 bg-amber-50/70 p-4" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <GitPullRequestArrow className="size-4 text-amber-700" />
        <h2 className="text-sm font-semibold text-amber-950">Amendment request #{request.requestNo} is waiting for a Super Admin</h2>
        <span className="text-xs text-amber-900">by {request.requestedBy} · {formatDateTime(request.requestedAt)}</span>
      </div>
      <p className="text-sm text-amber-950"><span className="font-medium">Reason:</span> {request.reason}</p>
      <p className="text-sm text-amber-950">Order value {formatINR(request.beforeTotal)} → <span className="font-semibold">{formatINR(request.afterTotal)}</span></p>
      <DiffList before={request.before} after={request.after} />
      {(canDecide || canWithdraw) && (
        <div className="space-y-2">
          {canDecide && <Textarea aria-label="Decision note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the requester (required to reject)" className="bg-white" />}
          <div className="flex flex-wrap gap-2">
            {canDecide && <Button size="sm" disabled={busy !== null} onClick={() => run("approve")}><Check /> Approve & apply</Button>}
            {canDecide && <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run("reject")}><X /> Reject</Button>}
            {canWithdraw && <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => run("withdraw")}><Undo2 /> Withdraw request</Button>}
          </div>
        </div>
      )}
      {!canDecide && <p className="text-xs text-amber-900">The order stays unchanged until a Super Admin (other than the requester) approves this request.</p>}
    </section>
  );
}

export function RevisionHistory({ requests, hasPending = false }: { requests: AmendmentView[]; hasPending?: boolean }) {
  if (!requests.length) {
    return (
      <p className="text-sm text-muted-foreground">
        {hasPending
          ? "No decided amendment requests yet. The pending request is shown at the top of this page."
          : "No amendment requests yet. Approved orders are changed only through a request approved by a Super Admin."}
      </p>
    );
  }
  return (
    <ol className="space-y-3">
      {requests.map((r) => (
        <li key={r.id} className="space-y-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Request #{r.requestNo}</span>
            <ToneBadge tone={TONE[r.status] ?? "muted"}>{LABEL[r.status] ?? r.status}</ToneBadge>
            {r.appliedRevision !== null && <span className="text-xs text-muted-foreground">→ revision {r.appliedRevision}</span>}
            <span className="ml-auto text-xs text-muted-foreground">{formatINR(r.beforeTotal)} → {formatINR(r.afterTotal)}</span>
          </div>
          <p className="text-sm">{r.reason}</p>
          <p className="text-xs text-muted-foreground">
            Requested by {r.requestedBy} · {formatDateTime(r.requestedAt)}
            {r.decidedAt && ` · ${r.status === "WITHDRAWN" ? "withdrawn" : `decided by ${r.decidedBy ?? "—"}`} ${formatDateTime(r.decidedAt)}`}
          </p>
          {r.decisionNote && <p className="text-xs"><span className="font-medium">Note:</span> {r.decisionNote}</p>}
          <DiffList before={r.before} after={r.after} />
        </li>
      ))}
    </ol>
  );
}
