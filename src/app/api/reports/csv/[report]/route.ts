import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { runReport, toCsv } from "@/modules/insights/reports";

/** CSV export of a commercial report. Same permission + project scoping as the on-screen report. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/reports/csv/[report]">) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { report } = await ctx.params;
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  try {
    const { def, rows } = await runReport(user, report, sp);
    const body = `﻿${toCsv(def.columns, rows)}`;
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${def.key}-${stamp}.csv"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
