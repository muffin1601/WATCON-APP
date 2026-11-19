import { db, type Prisma, type Tx } from "@/lib/db";

export type AuditEntry = {
  organizationId: string;
  actorId: string | null;
  action: string;
  entityType: "user" | "project" | "department" | "task" | "organization" | "role" | "session" | "item" | "brand" | "stock";
  entityId?: string | null;
  summary?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
};

/** Append-only audit trail. Pass the transaction client when inside a transaction. */
export async function writeAudit(entry: AuditEntry, client: Tx | typeof db = db): Promise<void> {
  await client.auditLog.create({
    data: {
      organizationId: entry.organizationId,
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      metadata: entry.metadata,
      ipAddress: entry.ipAddress ?? null,
    },
  });
}
