"use client";

import { callAction } from "@/lib/call-action";
import { Check, Copy, Eye, EyeOff, KeyRound, Lock, Power, PowerOff } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ConfirmDialog } from "@/components/shared/dialogs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { issueMemberResetLinkAction, resetMemberPasswordAction, setMemberStatusAction } from "@/modules/members/actions";
import { passwordPolicy } from "@/lib/auth/password-policy";
import { Field } from "@/components/forms/field";

export function MemberStatusConfirm({ id, name, status, trigger }: { id: string; name: string; status: string; trigger?: ReactNode }) {
  const active = status === "ACTIVE";
  return (
    <ConfirmDialog
      trigger={
        trigger ?? (
          <Button variant="outline" size="sm">
            {active ? <PowerOff /> : <Power />} {active ? "Deactivate" : "Activate"}
          </Button>
        )
      }
      title={active ? "Deactivate account?" : "Activate account?"}
      description={
        active
          ? `${name} will be signed out everywhere and will not be able to sign in. Their tasks, comments and history are kept.`
          : `${name} will be able to sign in again.`
      }
      confirmLabel={active ? "Deactivate" : "Activate"}
      destructive={active}
      onConfirm={async () => {
        const res = await callAction(setMemberStatusAction, id, active ? "INACTIVE" : "ACTIVE");
        if (res.ok) toast.success(active ? "Account deactivated" : "Account activated");
        else toast.error(res.error);
        return res.ok;
      }}
    />
  );
}

const passwordSchema = z.object({ password: passwordPolicy });
type PasswordForm = z.infer<typeof passwordSchema>;

export function ResetPasswordButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });
  const { errors } = form.formState;

  async function onSubmit(data: PasswordForm) {
    setIsLoading(true);
    const res = await callAction(resetMemberPasswordAction, id, data);
    setIsLoading(false);
    if (res.ok) {
      toast.success(`Password reset for ${name}`);
      setOpen(false);
      form.reset();
      setShowPassword(false);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Lock /> Reset password
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password for {name}</DialogTitle>
          <DialogDescription>Enter a new password. {name} will be signed out of all devices and must change password on next login.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Field id="password" label="New password" error={errors.password?.message}>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoFocus
                {...form.register("password")}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Resetting..." : "Reset password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Issues a one-time password-reset link (24h) and shows it once for secure hand-over. */
export function ResetAccessButton({ id, name }: { id: string; name: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy automatically. Select the link and copy it manually.");
    }
  }

  return (
    <>
      <ConfirmDialog
        trigger={
          <Button variant="outline" size="sm">
            <KeyRound /> Reset access
          </Button>
        }
        title="Reset access?"
        description={`A one-time password reset link will be created for ${name}. They will be signed out of all devices. The link expires in 24 hours.`}
        confirmLabel="Create reset link"
        onConfirm={async () => {
          const res = await callAction(issueMemberResetLinkAction, id);
          if (!res.ok) {
            toast.error(res.error);
            return false;
          }
          setCopied(false);
          setLink(res.data.link);
          return true;
        }}
      />
      <Dialog open={link !== null} onOpenChange={(o) => !o && setLink(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Password reset link</DialogTitle>
            <DialogDescription>
              Send this link privately to {name} (for example in a direct message). It works once and expires in 24 hours. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={link ?? ""} aria-label="Reset link" className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" variant="outline" onClick={copy} aria-label="Copy link">
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setLink(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
