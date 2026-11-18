import "server-only";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireActor } from "@/lib/auth/session";
import { toActionError, type ActionResult } from "@/lib/errors";
import type { SessionUser } from "@/modules/auth/service";

/**
 * Standard server-action wrapper: authenticates the caller (fresh session check on
 * every call), runs the service, revalidates affected routes and converts errors
 * into a safe, serializable ActionResult. Authorization itself lives in the services.
 */
export async function runAction<T>(fn: (actor: SessionUser) => Promise<T>, revalidate: string[] = []): Promise<ActionResult<T>> {
  try {
    const actor = await requireActor();
    const data = await fn(actor);
    for (const path of revalidate) revalidatePath(path, path.endsWith("]") ? "page" : "layout");
    return { ok: true, data };
  } catch (e) {
    unstable_rethrow(e);
    return toActionError(e);
  }
}
