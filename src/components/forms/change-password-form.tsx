"use client";

import { callAction } from "@/lib/call-action";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { passwordPolicy } from "@/lib/auth/password-policy";
import { applyActionResult } from "@/lib/forms";
import { changePasswordAction } from "@/modules/auth/actions";

const schema = z
  .object({ currentPassword: z.string().min(1, "Enter your current password."), newPassword: passwordPolicy, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Passwords do not match." });
type Values = z.infer<typeof schema>;

export function ChangePasswordForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { currentPassword: "", newPassword: "", confirm: "" } });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: Values) {
    const res = await callAction(changePasswordAction, values);
    if (!applyActionResult(res, form.setError, "Password updated. Other devices were signed out.")) return;
    form.reset();
    if (redirectTo) {
      router.replace(redirectTo);
      router.refresh();
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-sm space-y-4" noValidate>
      <Field id="currentPassword" label="Current password" error={errors.currentPassword?.message}>
        <Input id="currentPassword" type="password" autoComplete="current-password" aria-invalid={!!errors.currentPassword} {...form.register("currentPassword")} />
      </Field>
      <Field id="newPassword" label="New password" error={errors.newPassword?.message} help="At least 10 characters, including a letter and a number.">
        <Input id="newPassword" type="password" autoComplete="new-password" aria-invalid={!!errors.newPassword} {...form.register("newPassword")} />
      </Field>
      <Field id="confirm" label="Confirm new password" error={errors.confirm?.message}>
        <Input id="confirm" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} {...form.register("confirm")} />
      </Field>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" />} Update password
      </Button>
    </form>
  );
}
