import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { readAttachment } from "@/modules/documents/attachments";

const INLINE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

/**
 * GET /api/attachments/:id[?inline=1] — authorised download. Files are never public:
 * access follows the owning record's visibility; unauthorised ids return 404.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/attachments/[id]">) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (user.mustChangePassword) return NextResponse.json({ error: "Password change required" }, { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const file = await readAttachment(user, id);
    const inline = request.nextUrl.searchParams.get("inline") === "1" && INLINE_TYPES.has(file.mimeType);
    const name = file.fileName.replace(/["\\\r\n]/g, "_");
    return new NextResponse(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.bytes.length),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        // Inline PDFs/images render in a sandbox: no scripts, no same-origin access.
        "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
      },
    });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.status === 403 ? "Not found" : e.message }, { status: e.status === 403 ? 404 : e.status });
    console.error("[attachment-download]", e);
    return NextResponse.json({ error: "Could not read the file." }, { status: 500 });
  }
}
