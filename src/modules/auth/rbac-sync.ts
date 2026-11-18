import type { PrismaClient } from "@/generated/prisma/client";
import { PERMISSIONS, ROLE_KEYS, ROLE_LABELS, defaultPermissionsFor, isSuperAdminOnly } from "@/lib/permissions/definitions";

const ROLE_DESCRIPTIONS = {
  SUPER_ADMIN: "Full company-wide control, including administrators, roles and security settings.",
  ADMIN: "Manages projects, departments, team members and tasks within granted permissions.",
  USER: "Views and updates their own assigned tasks.",
} as const;

/**
 * Idempotently syncs the code-defined role & permission catalogue into the database.
 * - Creates missing roles/permissions and refreshes their labels.
 * - Grants default permissions only to roles that have no grants yet (so Super Admin
 *   customisations survive re-runs).
 * - SUPER_ADMIN is always granted the full catalogue; super-admin-only permissions are
 *   always revoked from other roles.
 */
export async function syncRbac(client: PrismaClient): Promise<void> {
  const roles = new Map<string, string>();
  for (const key of ROLE_KEYS) {
    const role = await client.role.upsert({
      where: { key },
      create: { key, name: ROLE_LABELS[key], description: ROLE_DESCRIPTIONS[key] },
      update: { name: ROLE_LABELS[key], description: ROLE_DESCRIPTIONS[key] },
    });
    roles.set(key, role.id);
  }

  const permissionIds = new Map<string, string>();
  for (const p of PERMISSIONS) {
    const row = await client.permission.upsert({
      where: { key: p.key },
      create: { key: p.key, name: p.name, group: p.group, description: p.description },
      update: { name: p.name, group: p.group, description: p.description },
    });
    permissionIds.set(p.key, row.id);
  }

  for (const key of ROLE_KEYS) {
    const roleId = roles.get(key)!;
    const existing = await client.rolePermission.count({ where: { roleId } });
    const grants = key === "SUPER_ADMIN" || existing === 0 ? defaultPermissionsFor(key) : [];
    if (grants.length) {
      await client.rolePermission.createMany({
        data: grants.map((g) => ({ roleId, permissionId: permissionIds.get(g)! })),
        skipDuplicates: true,
      });
    }
    if (key !== "SUPER_ADMIN") {
      const forbidden = PERMISSIONS.filter((p) => isSuperAdminOnly(p.key)).map((p) => permissionIds.get(p.key)!);
      await client.rolePermission.deleteMany({ where: { roleId, permissionId: { in: forbidden } } });
    }
  }
}
