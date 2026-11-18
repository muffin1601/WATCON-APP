import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { writeAudit } from "@/lib/audit";
import { sendMail } from "@/lib/mail";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "@/lib/auth/password";
import { clearRateLimit, isRateLimited, recordRateLimitHit, reserveAttempt } from "@/lib/auth/rate-limit";
import { ForbiddenError, RateLimitError, UnauthenticatedError, ValidationError } from "@/lib/errors";
import type { RoleKey } from "@/lib/permissions/definitions";

const LOGIN_WINDOW_MS = 15 * 60_000;
/** Failures for one account from one IP before that IP is locked out of that account. */
const LOGIN_MAX_FAILURES_PER_ACCOUNT_IP = 5;
/** Ceiling across all IPs (slows distributed guessing without letting one IP lock anyone out). */
const LOGIN_MAX_ATTEMPTS_PER_ACCOUNT = 20;
const LOGIN_MAX_FAILURES_PER_IP = 30;
const CHANGE_PASSWORD_MAX_FAILURES = 5;
const RESET_REQUESTS_PER_EMAIL_PER_HOUR = 3;
const RESET_TOKEN_TTL_MS = 30 * 60_000;
const ADMIN_RESET_TOKEN_TTL_MS = 24 * 3600_000;

export const GENERIC_LOGIN_ERROR = "Invalid email/username or password.";

export type SessionUser = {
  id: string;
  sessionId: string;
  organizationId: string;
  fullName: string;
  email: string;
  username: string;
  employeeCode: string;
  role: RoleKey;
  permissions: string[];
  mustChangePassword: boolean;
};

export type RequestContext = { ip?: string | null; userAgent?: string | null };

function idleMs() {
  return env().SESSION_IDLE_HOURS * 3600_000;
}
function maxMs() {
  return env().SESSION_MAX_DAYS * 24 * 3600_000;
}
export function sessionCookieMaxAgeSeconds() {
  return Math.floor(maxMs() / 1000);
}

/** Verifies credentials and opens a session. Returns the raw token for the cookie. */
export async function login(
  input: { identifier: string; password: string },
  ctx: RequestContext = {},
): Promise<{ token: string; user: { id: string; mustChangePassword: boolean } }> {
  const identifier = input.identifier.trim().toLowerCase();
  const ip = ctx.ip ?? "unknown";
  const accountKey = `login:account:${identifier}`;
  const pairKey = `login:pair:${identifier}:${ip}`;
  const ipKey = `login:ip:${ip}`;

  // Cheap pre-check first so a locked-out caller does not burn Argon2 CPU.
  if (
    (await isRateLimited(pairKey, LOGIN_MAX_FAILURES_PER_ACCOUNT_IP, LOGIN_WINDOW_MS)) ||
    (await isRateLimited(accountKey, LOGIN_MAX_ATTEMPTS_PER_ACCOUNT, LOGIN_WINDOW_MS)) ||
    (await isRateLimited(ipKey, LOGIN_MAX_FAILURES_PER_IP, LOGIN_WINDOW_MS))
  ) {
    throw new RateLimitError();
  }
  // Reserve the attempt BEFORE verifying: parallel requests cannot all slip through.
  const [pairOver, accountOver] = await Promise.all([
    reserveAttempt(pairKey, LOGIN_MAX_FAILURES_PER_ACCOUNT_IP, LOGIN_WINDOW_MS),
    reserveAttempt(accountKey, LOGIN_MAX_ATTEMPTS_PER_ACCOUNT, LOGIN_WINDOW_MS),
  ]);
  if (pairOver || accountOver) throw new RateLimitError();

  const user = await db.user.findFirst({
    where: identifier.includes("@") ? { email: identifier } : { username: identifier },
    select: { id: true, organizationId: true, passwordHash: true, status: true, mustChangePassword: true },
  });

  const valid = user ? await verifyPassword(user.passwordHash, input.password) : (await verifyAgainstDummy(input.password), false);

  if (!user || !valid) {
    await recordRateLimitHit(ipKey);
    throw new UnauthenticatedError(GENERIC_LOGIN_ERROR);
  }
  // Only revealed after a correct password, so it cannot be used for enumeration.
  if (user.status !== "ACTIVE") {
    throw new ForbiddenError("This account has been deactivated. Contact your administrator.");
  }

  await Promise.all([clearRateLimit(pairKey), clearRateLimit(accountKey)]);
  const token = generateToken();
  const now = Date.now();
  await db.$transaction(async (tx) => {
    await tx.session.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        expiresAt: new Date(now + Math.min(idleMs(), maxMs())),
        ipAddress: ctx.ip ?? null,
        userAgent: ctx.userAgent?.slice(0, 255) ?? null,
      },
    });
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(now) } });
    await writeAudit(
      { organizationId: user.organizationId, actorId: user.id, action: "auth.login", entityType: "session", ipAddress: ctx.ip },
      tx,
    );
  });
  return { token, user: { id: user.id, mustChangePassword: user.mustChangePassword } };
}

/** Resolves a raw session token into the authenticated user, applying idle + absolute expiry. */
export async function validateSessionToken(token: string): Promise<SessionUser | null> {
  if (!token || token.length > 200) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: { role: { include: { permissions: { include: { permission: { select: { key: true } } } } } } },
      },
    },
  });
  if (!session) return null;
  const now = Date.now();
  const absoluteExpiry = session.createdAt.getTime() + maxMs();
  if (session.expiresAt.getTime() <= now || absoluteExpiry <= now || session.user.status !== "ACTIVE") {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  // Sliding idle expiry, written at most once per ~5 minutes per session.
  if (now - session.lastSeenAt.getTime() > 5 * 60_000) {
    await db.session
      .update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(now), expiresAt: new Date(Math.min(now + idleMs(), absoluteExpiry)) },
      })
      .catch(() => undefined);
  }
  const u = session.user;
  return {
    id: u.id,
    sessionId: session.id,
    organizationId: u.organizationId,
    fullName: u.fullName,
    email: u.email,
    username: u.username,
    employeeCode: u.employeeCode,
    role: u.role.key,
    permissions: u.role.permissions.map((rp) => rp.permission.key),
    mustChangePassword: u.mustChangePassword,
  };
}

export async function logout(token: string): Promise<void> {
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session) return;
  await db.session.delete({ where: { id: session.id } });
  await writeAudit({ organizationId: session.user.organizationId, actorId: session.userId, action: "auth.logout", entityType: "session" });
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await db.session.deleteMany({ where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) } });
}

/**
 * `replaceExisting` is used only for admin-issued links. A self-service request must
 * NOT revoke other live tokens — otherwise anyone who knows a user's email could
 * cancel the 24 h link an admin just handed that user. Self-service volume is capped
 * per email instead (see requestPasswordReset), and every token is single-use.
 */
async function issueResetToken(userId: string, ttlMs: number, replaceExisting: boolean): Promise<string> {
  const token = generateToken();
  await db.$transaction([
    ...(replaceExisting ? [db.passwordResetToken.deleteMany({ where: { userId, usedAt: null } })] : []),
    db.passwordResetToken.create({ data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) } }),
  ]);
  return token;
}

export function resetLinkFor(token: string): string {
  return `${env().APP_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
}

/**
 * Self-service reset request. Always resolves without revealing whether the
 * email exists (protects against user enumeration).
 */
export async function requestPasswordReset(email: string, ctx: RequestContext = {}): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const key = `reset:${ctx.ip ?? "unknown"}`;
  if (await isRateLimited(key, 10, 60 * 60_000)) throw new RateLimitError();
  await recordRateLimitHit(key);
  // Per-email cap (independent of IP): stops inbox flooding of one person. Silent, so
  // it reveals nothing about whether the email is registered.
  if (await reserveAttempt(`reset:email:${normalized}`, RESET_REQUESTS_PER_EMAIL_PER_HOUR, 60 * 60_000)) return;

  const user = await db.user.findUnique({ where: { email: normalized } });
  if (!user || user.status !== "ACTIVE") return;
  const token = await issueResetToken(user.id, RESET_TOKEN_TTL_MS, false);
  await sendMail({
    to: user.email,
    subject: "Reset your Watcon password",
    text: `Hello ${user.fullName},\n\nUse this link to set a new password (valid for 30 minutes):\n${resetLinkFor(token)}\n\nIf you did not request this, you can ignore this email.`,
  });
  await writeAudit({ organizationId: user.organizationId, actorId: user.id, action: "auth.reset_requested", entityType: "user", entityId: user.id, ipAddress: ctx.ip });
}

/** Admin-issued one-time reset link (valid 24h) to hand to the employee securely. */
export async function createAdminResetLink(userId: string): Promise<string> {
  return resetLinkFor(await issueResetToken(userId, ADMIN_RESET_TOKEN_TTL_MS, true));
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const record = await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now() || record.user.status !== "ACTIVE") {
    throw new ValidationError("This reset link is invalid or has expired. Request a new one.");
  }
  const passwordHash = await hashPassword(newPassword);
  await db.$transaction(async (tx) => {
    // Atomic single-use: only one concurrent request can mark the token used.
    const used = await tx.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count !== 1) throw new ValidationError("This reset link has already been used.");
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash, passwordChangedAt: new Date(), mustChangePassword: false },
    });
    await tx.session.deleteMany({ where: { userId: record.userId } });
    await writeAudit(
      { organizationId: record.user.organizationId, actorId: record.userId, action: "auth.password_reset", entityType: "user", entityId: record.userId },
      tx,
    );
  });
}

export async function changePassword(
  user: Pick<SessionUser, "id" | "sessionId" | "organizationId">,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  // Throttled: a stolen session cookie must not allow unlimited guessing of the password.
  const key = `change-password:${user.id}`;
  if (await isRateLimited(key, CHANGE_PASSWORD_MAX_FAILURES, LOGIN_WINDOW_MS)) throw new RateLimitError();
  const record = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(record.passwordHash, currentPassword))) {
    await recordRateLimitHit(key);
    throw new ValidationError("Current password is incorrect.", { currentPassword: "Current password is incorrect." });
  }
  await clearRateLimit(key);
  if (currentPassword === newPassword) {
    throw new ValidationError("New password must be different.", { newPassword: "New password must be different from the current password." });
  }
  const passwordHash = await hashPassword(newPassword);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, passwordChangedAt: new Date(), mustChangePassword: false } });
    // Sign out other devices.
    await tx.session.deleteMany({ where: { userId: user.id, id: { not: user.sessionId } } });
    await writeAudit({ organizationId: user.organizationId, actorId: user.id, action: "auth.password_changed", entityType: "user", entityId: user.id }, tx);
  });
}
