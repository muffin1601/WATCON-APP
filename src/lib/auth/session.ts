import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { can, type PermissionKey } from "@/lib/permissions/definitions";
import { sessionCookieMaxAgeSeconds, validateSessionToken, type RequestContext, type SessionUser } from "@/modules/auth/service";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";

export const SESSION_COOKIE = "wc_session";

/** Data Access Layer entry point: the authenticated user for this request (memoised per request). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(token);
});

/** For pages: redirects to /login when signed out, and to /change-password when required. */
export async function requireUser(options: { allowPasswordChange?: boolean } = {}): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !options.allowPasswordChange) redirect("/change-password");
  return user;
}

/** For pages: renders the 404 page when the permission is missing (does not reveal the resource). */
export async function requirePagePermission(permission: PermissionKey): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, permission)) redirect("/dashboard?denied=1");
  return user;
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function requireActor(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthenticatedError();
  if (user.mustChangePassword) throw new ForbiddenError("You must change your password before continuing.");
  return user;
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionCookieMaxAgeSeconds(),
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getRequestContext(): Promise<RequestContext> {
  const h = await headers();
  // Prefer X-Real-IP: Vercel and the documented Nginx config set it from the socket
  // address, whereas the left-most X-Forwarded-For entry is supplied by the client and
  // could be rotated to dodge the per-IP login limit. (The per-account limit applies regardless.)
  const realIp = h.get("x-real-ip")?.trim();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return { ip: realIp || forwarded || null, userAgent: h.get("user-agent") };
}
