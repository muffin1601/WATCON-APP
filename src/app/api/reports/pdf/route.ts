import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse, type NextRequest } from "next/server";
import { createElement } from "react";
import { ReportPdf } from "@/components/reports/report-pdf";
import { getSessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { getReport } from "@/modules/reports/service";

/** GET /api/reports/pdf?type=project&id=… — authorized PDF export (read-only). */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (user.mustChangePassword) return NextResponse.json({ error: "Password change required" }, { status: 403 });
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const report = await getReport(user, params);
    const buffer = await renderToBuffer(createElement(ReportPdf, { report }) as Parameters<typeof renderToBuffer>[0]);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${report.fileName.replace(/[^A-Za-z0-9._-]/g, "_")}-${date}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status === 403 ? 404 : e.status });
    console.error("[pdf-export]", e);
    return NextResponse.json({ error: "Could not generate the PDF." }, { status: 500 });
  }
}
