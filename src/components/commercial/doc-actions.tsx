"use client";

import { Loader2, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type ActionResultLike = { ok: true; data?: unknown } | { ok: false; error: string };

export type DocActionDef = {
  key: string;
  label: string;
  icon?: LucideIcon;
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost";
  /** Ask for confirmation; `note` adds a text box (required when `noteRequired`). */
  confirm?: { title: string; description: string; noteLabel?: string; noteRequired?: boolean; destructive?: boolean; confirmLabel?: string; input?: boolean };
  success: string;
};

/**
 * Status-workflow buttons for a document. `run` is provided by the module's client wrapper
 * and calls the module's server action; the server re-validates permission, state and version.
 */
export function DocActions({ actions, run, onDone }: { actions: DocActionDef[]; run: (key: string, note: string | null) => Promise<ActionResultLike>; onDone?: (key: string, result: ActionResultLike) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function exec(a: DocActionDef, n: string | null) {
    setBusy(a.key);
    const res = await run(a.key, n);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    toast.success(a.success);
    setNote("");
    onDone?.(a.key, res);
    router.refresh();
    return true;
  }

  return (
    <>
      {actions.map((a) => {
        const Icon = a.icon;
        const button = (
          <Button key={a.key} size="sm" variant={a.variant ?? "outline"} disabled={busy !== null} onClick={a.confirm ? undefined : () => exec(a, null)}>
            {busy === a.key ? <Loader2 className="animate-spin" /> : Icon ? <Icon /> : null}
            {a.label}
          </Button>
        );
        if (!a.confirm) return button;
        const c = a.confirm;
        return (
          <ConfirmDialog
            key={a.key}
            trigger={button}
            title={c.title}
            destructive={c.destructive}
            confirmLabel={c.confirmLabel ?? a.label}
            description={
              <span className="block space-y-2">
                <span className="block">{c.description}</span>
                {c.noteLabel &&
                  (c.input ? (
                    <Input aria-label={c.noteLabel} placeholder={`${c.noteLabel}${c.noteRequired ? " (required)" : ""}`} value={note} onChange={(e) => setNote(e.target.value)} />
                  ) : (
                    <Textarea aria-label={c.noteLabel} rows={3} placeholder={`${c.noteLabel}${c.noteRequired ? " (required)" : ""}`} value={note} onChange={(e) => setNote(e.target.value)} />
                  ))}
              </span>
            }
            onConfirm={async () => {
              if (c.noteRequired && !note.trim()) {
                toast.error(`${c.noteLabel} is required.`);
                return false;
              }
              return exec(a, note.trim() || null);
            }}
          />
        );
      })}
    </>
  );
}
