import "server-only";
import { db } from "@/lib/db";
import { type Actor } from "@/lib/permissions/definitions";
import { memberAccessWhere, projectAccessWhere, taskAccessWhere } from "@/lib/permissions/scopes";

export type SearchHit = { type: "project" | "task" | "member" | "department"; id: string; title: string; subtitle: string; href: string };

/** Global header search — every entity query is scoped to the actor. */
export async function globalSearch(actor: Actor, raw: string): Promise<SearchHit[]> {
  const q = raw.trim().slice(0, 100);
  if (q.length < 2) return [];
  const contains = { contains: q, mode: "insensitive" as const };
  const [projects, tasks, members, departments] = await Promise.all([
    db.project.findMany({ where: { AND: [projectAccessWhere(actor), { OR: [{ name: contains }, { code: contains }, { siteAddress: contains }] }] }, take: 5, select: { id: true, code: true, name: true, siteAddress: true } }),
    db.task.findMany({ where: { AND: [taskAccessWhere(actor), { OR: [{ title: contains }, { code: contains }] }] }, take: 6, select: { id: true, code: true, title: true, project: { select: { name: true } } } }),
    db.user.findMany({ where: { AND: [memberAccessWhere(actor), { OR: [{ fullName: contains }, { employeeCode: contains }, { email: contains }] }] }, take: 5, select: { id: true, employeeCode: true, fullName: true, designation: true } }),
    db.department.findMany({ where: { organizationId: actor.organizationId, OR: [{ name: contains }, { code: contains }] }, take: 4, select: { id: true, code: true, name: true } }),
  ]);
  return [
    ...projects.map((p) => ({ type: "project" as const, id: p.id, title: p.name, subtitle: `${p.code} · ${p.siteAddress}`, href: `/projects/${p.id}` })),
    ...tasks.map((t) => ({ type: "task" as const, id: t.id, title: t.title, subtitle: `${t.code} · ${t.project.name}`, href: `/tasks/${t.id}` })),
    ...members.map((m) => ({ type: "member" as const, id: m.id, title: m.fullName, subtitle: `${m.employeeCode}${m.designation ? ` · ${m.designation}` : ""}`, href: `/team-members/${m.id}` })),
    ...departments.map((d) => ({ type: "department" as const, id: d.id, title: d.name, subtitle: d.code, href: `/departments/${d.id}` })),
  ];
}
