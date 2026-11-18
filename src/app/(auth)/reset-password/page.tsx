import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Set a new password" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  if (typeof token !== "string" || token.length < 10) {
    return (
      <>
        <h1 className="text-lg font-semibold">Invalid reset link</h1>
        <p className="mt-2 text-sm text-muted-foreground">This link is incomplete. Request a new one.</p>
        <Link href="/forgot-password" className="mt-4 inline-block text-sm text-primary hover:underline">
          Request a new link
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="text-lg font-semibold">Set a new password</h1>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">At least 10 characters, including a letter and a number.</p>
      <ResetPasswordForm token={token} />
    </>
  );
}
