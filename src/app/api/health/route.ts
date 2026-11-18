import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * GET /api/health — liveness + readiness probe for load balancers, Docker and uptime
 * monitors. Public (no session) and deliberately uninformative: it reports only
 * whether the environment is valid and the database answers `SELECT 1`. Never
 * include connection strings, versions or error details in the response.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    env();
  } catch (e) {
    console.error("[health] invalid environment", e instanceof Error ? e.message : e);
    return NextResponse.json({ status: "error", check: "config" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "up", latencyMs: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[health] database check failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ status: "error", check: "database" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
