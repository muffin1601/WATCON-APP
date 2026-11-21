import "server-only";
import { db } from "@/lib/db";
import { can, type Actor } from "@/lib/permissions/definitions";
import { projectAccessWhere, projectManageWhere } from "@/lib/permissions/scopes";
import type { EntityAccess } from "@/modules/documents/access";

/** Project-level documents ("Documents & Proofs" tab): visible to project viewers, uploadable by project members. */
export async function projectAccess(actor: Actor, id: string): Promise<EntityAccess | null> {
  const p = await db.project.findFirst({ where: { AND: [projectAccessWhere(actor), { id }] }, select: { id: true, code: true, name: true } });
  if (!p) return null;
  const member = (await db.project.count({ where: { AND: [projectManageWhere(actor), { id }] } })) > 0;
  const uploader = member && (can(actor, "projects.edit") || can(actor, "grn.create") || can(actor, "mrp.manage") || can(actor, "rabill.manage") || can(actor, "po.create") || can(actor, "cpo.manage"));
  return { projectId: p.id, label: `${p.code} – ${p.name}`, canView: true, canUpload: uploader, locked: false };
}
