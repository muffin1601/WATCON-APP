import "server-only";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions/definitions";
import { resolveAccess } from "./access";

export type ActivityItem = { id: string; at: string; actor: string; action: string; summary: string };

/** Immutable audit history of one record (including its attachments), newest first. */
export async function entityActivity(actor: Actor, entityType: string, entityId: string, take = 100): Promise<ActivityItem[]> {
  const access = await resolveAccess(actor, entityType, entityId);
  if (!access) throw new NotFoundError("Record");
  const rows = await db.auditLog.findMany({
    where: {
      organizationId: actor.organizationId,
      OR: [{ entityType, entityId }, { entityType: "attachment", metadata: { path: ["entityId"], equals: entityId } }],
    },
    orderBy: { createdAt: "desc" },
    take,
    include: { actor: { select: { fullName: true } } },
  });
  return rows.map((r) => ({ id: r.id, at: r.createdAt.toISOString(), actor: r.actor?.fullName ?? "System", action: r.action, summary: r.summary ?? r.action }));
}

/** Commercial activity of a project (documents, stock, evidence), newest first. */
export async function projectCommercialActivity(actor: Actor, projectId: string, take = 100): Promise<(ActivityItem & { entityType: string; entityId: string | null })[]> {
  const access = await resolveAccess(actor, "project", projectId);
  if (!access) throw new NotFoundError("Project");
  const rows = await db.auditLog.findMany({ where: { organizationId: actor.organizationId, projectId }, orderBy: { createdAt: "desc" }, take, include: { actor: { select: { fullName: true } } } });
  return rows.map((r) => ({ id: r.id, at: r.createdAt.toISOString(), actor: r.actor?.fullName ?? "System", action: r.action, summary: r.summary ?? r.action, entityType: r.entityType, entityId: r.entityId }));
}
