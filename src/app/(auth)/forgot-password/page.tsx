"use client";

import { callAction } from "@/lib/call-action";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Field, FormError } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPasswordAction } from "@/modules/auth/actions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await callAction(forgotPasswordAction, { email });
    setBusy(false);
    if (res.ok) setSent(true);
    else setError(res.error);
  }

  return (
    <>
      <h1 className="text-lg font-semibold">Reset your password</h1>
      {sent ? (
        <div className="mt-4 space-y-4">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">If an active account exists for that email, a reset link has been sent. It expires in 30 minutes.</p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
          <p className="text-sm text-muted-foreground">Enter your work email. If it belongs to an active account, we&apos;ll email a reset link. You can also ask an administrator for a reset link.</p>
          <FormError message={error} />
          <Field id="email" label="Work email">
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" className="h-9 w-full" disabled={busy || !email}>
            {busy && <Loader2 className="animate-spin" />} Send reset link
          </Button>
          <div className="text-center">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
              Back to sign in
            </Link>
          </div>
        </form>
      )}
    </>
  );
}
