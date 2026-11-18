import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await getSessionUser();
  if (user) redirect(user.mustChangePassword ? "/change-password" : "/dashboard");
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const reset = sp.reset === "1";
  return (
    <>
      <h1 className="text-lg font-semibold">Sign in</h1>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">Use your work email or username.</p>
      {reset && <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Your password was updated. Sign in with your new password.</p>}
      <LoginForm next={next} />
    </>
  );
}
