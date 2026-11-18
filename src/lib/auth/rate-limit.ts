import { db } from "@/lib/db";

/**
 * Database-backed sliding-window rate limiter. Works across multiple app
 * instances (unlike in-memory limiters). `hit` records an event; `isLimited`
 * counts events in the window.
 */
export async function isRateLimited(key: string, limit: number, windowMs: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const count = await db.rateLimitEvent.count({ where: { key, createdAt: { gte: since } } });
  return count >= limit;
}

/**
 * Records an attempt FIRST and then counts (including this one), so a burst of
 * parallel requests cannot all pass a check-then-record window. Returns true when
 * the attempt exceeds the limit.
 */
export async function reserveAttempt(key: string, limit: number, windowMs: number): Promise<boolean> {
  await db.rateLimitEvent.create({ data: { key } });
  const since = new Date(Date.now() - windowMs);
  const count = await db.rateLimitEvent.count({ where: { key, createdAt: { gte: since } } });
  return count > limit;
}

export async function recordRateLimitHit(key: string): Promise<void> {
  await db.rateLimitEvent.create({ data: { key } });
}

export async function clearRateLimit(key: string): Promise<void> {
  await db.rateLimitEvent.deleteMany({ where: { key } });
}

/** Housekeeping: delete events older than a day (called opportunistically). */
export async function pruneRateLimitEvents(): Promise<void> {
  await db.rateLimitEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 3600_000) } } });
}
