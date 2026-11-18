import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/forms/change-password-form";
import { requireUser } from "@/lib/auth/session";
import { logoutAction } from "@/modules/auth/actions";

export const metadata: Metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPasswordChange: true });
  return (
    <>
      <h1 className="text-lg font-semibold">Choose a new password</h1>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        {user.mustChangePassword ? "Your account was created with a temporary password. Set your own password to continue." : "Update the password for your account."}
      </p>
      <ChangePasswordForm redirectTo="/dashboard" />
      <form action={logoutAction} className="mt-4 text-center">
        <button type="submit" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
          Sign out
        </button>
      </form>
    </>
  );
}
