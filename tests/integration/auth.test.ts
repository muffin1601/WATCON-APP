import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/auth/tokens";
import { AppError } from "@/lib/errors";
import { GENERIC_LOGIN_ERROR, changePassword, createAdminResetLink, login, logout, requestPasswordReset, resetPassword, validateSessionToken } from "@/modules/auth/service";
import { TEST_PASSWORD, standardFixture } from "./helpers";

let fx: Awaited<ReturnType<typeof standardFixture>>;
beforeEach(async () => {
  fx = await standardFixture();
});

async function errorOf(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (e) {
    return e as AppError;
  }
  throw new Error("Expected promise to reject");
}

describe("login", () => {
  it("logs in with email or username and creates a hashed session", async () => {
    const byEmail = await login({ identifier: fx.users.amit.email.toUpperCase(), password: TEST_PASSWORD }, { ip: "1.1.1.1" });
    const byUsername = await login({ identifier: fx.users.amit.username, password: TEST_PASSWORD }, { ip: "1.1.1.1" });
    expect(byEmail.user.id).toBe(fx.users.amit.id);
    expect(byUsername.user.id).toBe(fx.users.amit.id);
    // Raw token is never stored — only its hash.
    expect(await db.session.count({ where: { tokenHash: byEmail.token } })).toBe(0);
    expect(await db.session.count({ where: { tokenHash: hashToken(byEmail.token) } })).toBe(1);
    const session = await validateSessionToken(byEmail.token);
    expect(session?.role).toBe("USER");
    expect(session?.permissions).toContain("tasks.update_assigned");
  });

  it("returns the same generic error for unknown accounts and wrong passwords (no enumeration)", async () => {
    const unknown = await errorOf(login({ identifier: "nobody@example.test", password: "whatever-123" }, { ip: "2.2.2.2" }));
    const wrong = await errorOf(login({ identifier: fx.users.amit.email, password: "wrong-password-1" }, { ip: "2.2.2.2" }));
    expect(unknown.message).toBe(GENERIC_LOGIN_ERROR);
    expect(wrong.message).toBe(GENERIC_LOGIN_ERROR);
    expect(unknown.code).toBe(wrong.code);
  });

  it("blocks deactivated accounts", async () => {
    await db.user.update({ where: { id: fx.users.rahul.id }, data: { status: "INACTIVE" } });
    const err = await errorOf(login({ identifier: fx.users.rahul.email, password: TEST_PASSWORD }, { ip: "3.3.3.3" }));
    expect(err.code).toBe("FORBIDDEN");
  });

  it("locks an account out for the attacking IP only, so an attacker cannot lock the real user out", async () => {
    for (let i = 0; i < 5; i++) await errorOf(login({ identifier: fx.users.sara.email, password: "bad-password-1" }, { ip: "9.9.9.9" }));
    expect((await errorOf(login({ identifier: fx.users.sara.email, password: TEST_PASSWORD }, { ip: "9.9.9.9" }))).code).toBe("RATE_LIMITED");
    // The real user, from their own network, can still sign in.
    const ok = await login({ identifier: fx.users.sara.email, password: TEST_PASSWORD }, { ip: "10.0.0.5" });
    expect(ok.user.id).toBe(fx.users.sara.id);
  });

  it("caps distributed guessing across IPs per account", async () => {
    for (let i = 0; i < 20; i++) await errorOf(login({ identifier: fx.users.rahul.email, password: "bad-password-1" }, { ip: `9.9.${i}.1` }));
    expect((await errorOf(login({ identifier: fx.users.rahul.email, password: TEST_PASSWORD }, { ip: "10.0.0.6" }))).code).toBe("RATE_LIMITED");
  });

  it("parallel login bursts cannot exceed the per-account+IP limit", async () => {
    const results = await Promise.all(
      Array.from({ length: 15 }, () => errorOf(login({ identifier: fx.users.amit.email, password: "bad-password-1" }, { ip: "7.7.7.7" }))),
    );
    // At most 5 attempts may reach password verification; the rest are rate-limited.
    expect(results.filter((e) => e.code !== "RATE_LIMITED").length).toBeLessThanOrEqual(5);
  });
});

describe("sessions", () => {
  it("rejects expired sessions and sessions of deactivated users, and logout revokes", async () => {
    const { token } = await login({ identifier: fx.users.amit.email, password: TEST_PASSWORD });
    await db.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await validateSessionToken(token)).toBeNull();
    expect(await db.session.count()).toBe(0);

    const second = await login({ identifier: fx.users.amit.email, password: TEST_PASSWORD });
    await db.user.update({ where: { id: fx.users.amit.id }, data: { status: "INACTIVE" } });
    expect(await validateSessionToken(second.token)).toBeNull();

    await db.user.update({ where: { id: fx.users.amit.id }, data: { status: "ACTIVE" } });
    const third = await login({ identifier: fx.users.amit.email, password: TEST_PASSWORD });
    await logout(third.token);
    expect(await validateSessionToken(third.token)).toBeNull();
  });

  it("enforces the absolute session lifetime", async () => {
    const { token } = await login({ identifier: fx.users.amit.email, password: TEST_PASSWORD });
    await db.session.updateMany({ data: { createdAt: new Date(Date.now() - 8 * 24 * 3600_000) } });
    expect(await validateSessionToken(token)).toBeNull();
  });
});

describe("password reset & change", () => {
  it("does not reveal whether an email exists and issues a single-use token", async () => {
    await expect(requestPasswordReset("missing@example.test", { ip: "4.4.4.4" })).resolves.toBeUndefined();
    expect(await db.passwordResetToken.count()).toBe(0);
    await requestPasswordReset(fx.users.amit.email, { ip: "4.4.4.4" });
    expect(await db.passwordResetToken.count({ where: { userId: fx.users.amit.id } })).toBe(1);
  });

  it("resets the password once and revokes sessions", async () => {
    const { token: sessionToken } = await login({ identifier: fx.users.amit.email, password: TEST_PASSWORD });
    const link = await createAdminResetLink(fx.users.amit.id);
    const token = new URL(link).searchParams.get("token")!;
    await resetPassword(token, "Brand-new-pass-42");
    expect(await validateSessionToken(sessionToken)).toBeNull();
    expect((await errorOf(resetPassword(token, "Another-pass-43"))).code).toBe("VALIDATION");
    const ok = await login({ identifier: fx.users.amit.email, password: "Brand-new-pass-42" });
    expect(ok.user.id).toBe(fx.users.amit.id);
  });

  it("a self-service request cannot cancel an admin-issued link; requests are capped per email", async () => {
    const link = await createAdminResetLink(fx.users.amit.id);
    for (let i = 0; i < 6; i++) await requestPasswordReset(fx.users.amit.email, { ip: `5.5.5.${i}` });
    // 1 admin link + only 3 self-service tokens (per-email cap), admin link still valid.
    expect(await db.passwordResetToken.count({ where: { userId: fx.users.amit.id } })).toBe(4);
    await resetPassword(new URL(link).searchParams.get("token")!, "Admin-link-pass-44");
  });

  it("throttles wrong current-password guesses", async () => {
    const { token } = await login({ identifier: fx.users.rahul.email, password: TEST_PASSWORD });
    const s = (await validateSessionToken(token))!;
    for (let i = 0; i < 5; i++) await errorOf(changePassword(s, `wrong-guess-${i}`, "Newer-pass-123"));
    expect((await errorOf(changePassword(s, TEST_PASSWORD, "Newer-pass-123"))).code).toBe("RATE_LIMITED");
  });

  it("change password requires the current password", async () => {
    const { token } = await login({ identifier: fx.users.amit.email, password: TEST_PASSWORD });
    const s = (await validateSessionToken(token))!;
    expect((await errorOf(changePassword(s, "wrong-current-1", "Newer-pass-123"))).code).toBe("VALIDATION");
    await changePassword(s, TEST_PASSWORD, "Newer-pass-123");
    expect(await validateSessionToken(token)).not.toBeNull(); // current session kept
  });
});
