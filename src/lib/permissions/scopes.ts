import type { Prisma } from "@/generated/prisma/client";
import { can, type Actor } from "./definitions";

/**
 * Resource-level authorization expressed as Prisma `where` fragments. Every list,
 * count, detail and report query is AND-ed with one of these, so authorization is
 * enforced in the database query itself (no post-filtering, no IDOR via URL).
 */

/** Projects the actor manages, created or is a member of ("joined" projects). */
export function projectMembershipWhere(actor: Actor): Prisma.ProjectWhereInput {
  return {
    organizationId: actor.organizationId,
    OR: [{ managerId: actor.id }, { createdById: actor.id }, { members: { some: { userId: actor.id } } }],
  };
}

/** Projects the actor may view: joined projects plus projects containing tasks assigned to them. */
export function projectAccessWhere(actor: Actor): Prisma.ProjectWhereInput {
  if (can(actor, "projects.view_all")) return { organizationId: actor.organizationId };
  return {
    organizationId: actor.organizationId,
    OR: [
      { managerId: actor.id },
      { createdById: actor.id },
      { members: { some: { userId: actor.id } } },
      { tasks: { some: { assignees: { some: { userId: actor.id } } } } },
    ],
  };
}

/** Projects the actor may manage (edit / archive / post status / create tasks in), given the matching permission. */
export function projectManageWhere(actor: Actor): Prisma.ProjectWhereInput {
  if (can(actor, "projects.view_all")) return { organizationId: actor.organizationId };
  return projectMembershipWhere(actor);
}

/** Tasks the actor may view. */
export function taskAccessWhere(actor: Actor): Prisma.TaskWhereInput {
  if (can(actor, "tasks.view_all")) return { organizationId: actor.organizationId };
  const own: Prisma.TaskWhereInput[] = [{ assignees: { some: { userId: actor.id } } }, { ownerId: actor.id }];
  if (can(actor, "tasks.manage") || can(actor, "tasks.create")) {
    return {
      organizationId: actor.organizationId,
      OR: [...own, { createdById: actor.id }, { project: projectManageWhere(actor) }],
    };
  }
  return { organizationId: actor.organizationId, OR: own };
}

/** Tasks the actor may fully edit / reassign / cancel. */
export function taskManageWhere(actor: Actor): Prisma.TaskWhereInput {
  if (!can(actor, "tasks.manage")) return { id: { in: [] } };
  if (can(actor, "tasks.view_all")) return { organizationId: actor.organizationId };
  return {
    organizationId: actor.organizationId,
    OR: [{ createdById: actor.id }, { project: projectManageWhere(actor) }],
  };
}

/** Team members (users) the actor may view. */
export function memberAccessWhere(actor: Actor): Prisma.UserWhereInput {
  if (can(actor, "members.view")) return { organizationId: actor.organizationId };
  return { organizationId: actor.organizationId, id: actor.id };
}

/**
 * Accounts the actor may edit. Admins with members.manage may edit USER-role
 * accounts only; administrators (and role changes) need users.manage_admins.
 * Nobody may edit a Super Admin except a Super Admin.
 */
export function memberManageWhere(actor: Actor): Prisma.UserWhereInput {
  if (actor.role === "SUPER_ADMIN") return { organizationId: actor.organizationId };
  if (!can(actor, "members.manage")) return { id: { in: [] } };
  return { organizationId: actor.organizationId, role: { key: "USER" } };
}
