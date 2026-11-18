import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { ForbiddenError, ValidationError, zodFieldErrors } from "@/lib/errors";
import { can, isPermissionKey, isSuperAdminOnly, PERMISSIONS, type Actor } from "@/lib/permissions/definitions";
import { optionalText, text } from "@/lib/validations/common";

const MAX_LOGO_BYTES = 256 * 1024;

export const companySchema = z.object({
  name: text("Company name", 120, 2),
  legalName: optionalText("Legal name", 200),
  address: optionalText("Address", 500),
  phone: optionalText("Phone", 30),
  email: z.string().trim().email("Enter a valid email.").max(160).optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
  logoDataUrl: z
    .string()
    .optional()
    .nullable()
    .refine((v) => !v || /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v), "Logo must be a PNG or JPEG image.")
    .refine((v) => !v || Math.floor((v.length - v.indexOf(",") - 1) * 0.75) <= MAX_LOGO_BYTES, "Logo must be 256 KB or smaller.")
    .transform((v) => (v ? v : null)),
});

export async function getOrganization(organizationId: string) {
  return db.organization.findUniqueOrThrow({ where: { id: organizationId } });
}

export async function updateCompany(actor: Actor, input: unknown) {
  if (!can(actor, "settings.company")) throw new ForbiddenError();
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Please correct the highlighted fields.", zodFieldErrors(parsed.error.issues));
  const org = await db.organization.update({ where: { id: actor.organizationId }, data: parsed.data });
  await writeAudit({ organizationId: actor.organizationId, actorId: actor.id, action: "organization.updated", entityType: "organization", entityId: org.id, summary: "Updated company settings" });
  return org;
}

export async function getRoleMatrix() {
  const roles = await db.role.findMany({ include: { permissions: { include: { permission: true } } }, orderBy: { key: "asc" } });
  return {
    permissions: PERMISSIONS.map((p) => ({ key: p.key, name: p.name, group: p.group, description: p.description, superAdminOnly: isSuperAdminOnly(p.key) })),
    roles: roles.map((r) => ({ key: r.key, name: r.name, granted: r.permissions.map((rp) => rp.permission.key) })),
  };
}

const roleUpdateSchema = z.object({ role: z.enum(["ADMIN", "USER"]), permissions: z.array(z.string()).max(100) });

/** Super Admin edits Admin/User grants. Super-admin-only permissions can never be granted. */
export async function updateRolePermissions(actor: Actor, input: unknown) {
  if (!can(actor, "settings.roles")) throw new ForbiddenError();
  const parsed = roleUpdateSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Invalid role update.");
  const keys = [...new Set(parsed.data.permissions)];
  for (const k of keys) {
    if (!isPermissionKey(k)) throw new ValidationError(`Unknown permission: ${k}`);
    if (isSuperAdminOnly(k)) throw new ForbiddenError(`"${k}" can only be held by a Super Admin.`);
  }
  await db.$transaction(async (tx) => {
    const role = await tx.role.findUniqueOrThrow({ where: { key: parsed.data.role } });
    const perms = await tx.permission.findMany({ where: { key: { in: keys } } });
    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
    await tx.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })) });
    await writeAudit({ organizationId: actor.organizationId, actorId: actor.id, action: "role.permissions_updated", entityType: "role", entityId: role.id, summary: `Updated ${role.name} permissions`, metadata: { permissions: keys } }, tx);
  });
}

export async function listAuditLogs(actor: Actor, opts: { page?: number; pageSize?: number; q?: string; entityType?: string }) {
  if (!can(actor, "audit.view")) throw new ForbiddenError();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, opts.pageSize ?? 50));
  const where = {
    organizationId: actor.organizationId,
    ...(opts.entityType ? { entityType: opts.entityType } : {}),
    ...(opts.q ? { OR: [{ summary: { contains: opts.q, mode: "insensitive" as const } }, { action: { contains: opts.q, mode: "insensitive" as const } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { actor: { select: { fullName: true, employeeCode: true } } } }),
  ]);
  return { rows, total, page, pageSize };
}
