"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { passwordPolicy } from "@/lib/auth/password-policy";
import { SESSION_COOKIE, clearSessionCookie, getRequestContext, getSessionUser, setSessionCookie } from "@/lib/auth/session";
import { toActionError, type ActionResult } from "@/lib/errors";
import { changePassword, login, logout, requestPasswordReset, resetPassword } from "./service";

const loginSchema = z.object({ identifier: z.string().trim().min(1, "Enter your email or username.").max(160), password: z.string().min(1, "Enter your password.").max(200) });

/** Only allow same-site relative redirects after login (prevents open redirects). */
function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/dashboard";
}

export async function loginAction(input: unknown, next?: string): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter your email/username and password." };
  try {
    const result = await login(parsed.data, await getRequestContext());
    await setSessionCookie(result.token);
    return { ok: true, data: { redirectTo: result.user.mustChangePassword ? "/change-password" : safeNext(next) } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function logoutAction(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await logout(token).catch(() => undefined);
  await clearSessionCookie();
  redirect("/login");
}

export async function forgotPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ email: z.string().trim().email("Enter a valid email address.") }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email address.", fieldErrors: { email: "Enter a valid email address." } };
  try {
    await requestPasswordReset(parsed.data.email, await getRequestContext());
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

const resetSchema = z
  .object({ token: z.string().min(10).max(200), password: passwordPolicy, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match." });

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  try {
    await resetPassword(parsed.data.token, parsed.data.password);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

const changeSchema = z
  .object({ currentPassword: z.string().min(1, "Enter your current password."), newPassword: passwordPolicy, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Passwords do not match." });

/** Works for users who are forced to change their password (no requireActor gate). */
export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Your session has expired. Please sign in again.", code: "UNAUTHENTICATED" };
  const parsed = changeSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message]));
    return { ok: false, error: "Please correct the highlighted fields.", fieldErrors };
  }
  try {
    await changePassword(user, parsed.data.currentPassword, parsed.data.newPassword);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
