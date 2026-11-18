"use client";

type TransportFailure = { ok: false; error: string; code?: undefined; fieldErrors?: undefined };

/**
 * Calls a Server Action and converts transport-level failures (network down, server
 * restarted / redeployed so the page is stale, or a request blocked or altered by a
 * browser extension or proxy) into a normal `{ ok: false }` result, so the UI shows a
 * message instead of crashing with "An unexpected response was received from the server".
 */
export async function callAction<A extends unknown[], R extends { ok: boolean }>(fn: (...args: A) => Promise<R>, ...args: A): Promise<R | TransportFailure> {
  try {
    return await fn(...args);
  } catch (e) {
    console.warn("[server-action] request failed", e);
    return { ok: false, error: "Could not reach the server. Reload the page and try again. If it keeps happening, disable browser extensions (VPN / proxy) for this site." };
  }
}
