/**
 * Central permission catalogue — the single source of truth for permission keys.
 * Pure module (no server imports) so UI can use it for display decisions; every
 * decision is re-checked server-side in services/policies.
 */

export const ROLE_KEYS = ["SUPER_ADMIN", "ADMIN", "USER"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const ROLE_LABELS: Record<RoleKey, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  USER: "User",
};

type PermissionDef = {
  key: string;
  name: string;
  group: "Dashboard" | "Projects" | "Departments" | "Team Members" | "Tasks" | "Reports" | "Inventory" | "Administration";
  description: string;
  /** Can never be granted to ADMIN/USER, even if a row exists in role_permissions. */
  superAdminOnly?: boolean;
  defaults: RoleKey[];
};

export const PERMISSIONS = [
  { key: "dashboard.view", name: "View dashboard", group: "Dashboard", description: "Open the dashboard.", defaults: ["ADMIN", "USER"] },

  { key: "projects.view_all", name: "View all projects", group: "Projects", description: "See every project, not only projects the user manages, created, belongs to or has tasks in.", defaults: [] },
  { key: "projects.create", name: "Create projects", group: "Projects", description: "Create new projects / sites.", defaults: ["ADMIN"] },
  { key: "projects.edit", name: "Edit projects", group: "Projects", description: "Edit details and members of accessible projects.", defaults: ["ADMIN"] },
  { key: "projects.archive", name: "Archive projects", group: "Projects", description: "Archive and restore accessible projects.", defaults: ["ADMIN"] },
  { key: "projects.post_status", name: "Post project status", group: "Projects", description: "Write current-status updates on accessible projects.", defaults: ["ADMIN"] },

  { key: "departments.manage", name: "Manage departments", group: "Departments", description: "Create, edit and deactivate departments and their memberships.", defaults: ["ADMIN"] },

  { key: "members.view", name: "View team directory", group: "Team Members", description: "See the full team member directory and profiles.", defaults: ["ADMIN"] },
  { key: "members.manage", name: "Manage team members", group: "Team Members", description: "Create and edit team members with the User role, activate/deactivate them and issue password-reset links.", defaults: ["ADMIN"] },
  { key: "users.manage_admins", name: "Manage administrators", group: "Administration", description: "Create administrators and change any account's role.", superAdminOnly: true, defaults: [] },

  { key: "tasks.view_all", name: "View all tasks", group: "Tasks", description: "See every task in the organization.", defaults: [] },
  { key: "tasks.create", name: "Create tasks", group: "Tasks", description: "Create and assign tasks on accessible projects.", defaults: ["ADMIN"] },
  { key: "tasks.manage", name: "Manage tasks", group: "Tasks", description: "Edit, reassign and cancel tasks on accessible projects.", defaults: ["ADMIN"] },
  { key: "tasks.update_assigned", name: "Update assigned tasks", group: "Tasks", description: "Update status and progress of tasks assigned to the user.", defaults: ["ADMIN", "USER"] },
  { key: "tasks.comment", name: "Comment on tasks", group: "Tasks", description: "Add comments to visible tasks.", defaults: ["ADMIN", "USER"] },

  { key: "reports.view", name: "Task reports", group: "Reports", description: "Print / export / share project, department, member and global task lists within the user's access.", defaults: ["ADMIN"] },
  { key: "reports.own", name: "Own task report", group: "Reports", description: "Print / export the user's own task list.", defaults: ["ADMIN", "USER"] },

  { key: "items.view", name: "View inventory", group: "Inventory", description: "See items, brands, brand-wise stock balances and the stock ledger.", defaults: ["ADMIN"] },
  { key: "items.manage", name: "Manage items & brands", group: "Inventory", description: "Create, edit and deactivate items and brands, and link brands to items.", defaults: ["ADMIN"] },
  { key: "stock.post", name: "Post stock inward / outward", group: "Inventory", description: "Record stock received (inward) and issued (outward).", defaults: ["ADMIN"] },
  { key: "stock.adjust", name: "Stock adjustments", group: "Inventory", description: "Post opening stock and stock adjustments (a reason is mandatory).", defaults: [] },

  { key: "settings.company", name: "Company settings", group: "Administration", description: "Edit company name, logo and contact details.", superAdminOnly: true, defaults: [] },
  { key: "settings.roles", name: "Roles & permissions", group: "Administration", description: "Change which permissions Admin and User roles have.", superAdminOnly: true, defaults: [] },
  { key: "audit.view", name: "Audit log", group: "Administration", description: "View the organization audit log.", superAdminOnly: true, defaults: [] },
] as const satisfies readonly PermissionDef[];

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as PermissionKey[];

const SUPER_ADMIN_ONLY = new Set<string>(
  PERMISSIONS.filter((p) => "superAdminOnly" in p && p.superAdminOnly).map((p) => p.key),
);

export function isSuperAdminOnly(key: string): boolean {
  return SUPER_ADMIN_ONLY.has(key);
}

export function isPermissionKey(key: string): key is PermissionKey {
  return (PERMISSION_KEYS as string[]).includes(key);
}

/** Default grants used by the seed (SUPER_ADMIN implicitly has everything). */
export function defaultPermissionsFor(role: RoleKey): PermissionKey[] {
  if (role === "SUPER_ADMIN") return [...PERMISSION_KEYS];
  return PERMISSIONS.filter((p) => (p.defaults as readonly RoleKey[]).includes(role)).map((p) => p.key);
}

/** Minimal identity used for authorization decisions. */
export type Actor = {
  id: string;
  organizationId: string;
  role: RoleKey;
  permissions: readonly string[];
};

/**
 * The single permission check. SUPER_ADMIN always passes; super-admin-only
 * permissions are never granted to other roles regardless of database rows.
 */
export function can(actor: Pick<Actor, "role" | "permissions">, permission: PermissionKey): boolean {
  if (actor.role === "SUPER_ADMIN") return true;
  if (isSuperAdminOnly(permission)) return false;
  return actor.permissions.includes(permission);
}
