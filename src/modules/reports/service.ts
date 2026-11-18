import "server-only";
import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { can, type Actor } from "@/lib/permissions/definitions";
import { memberAccessWhere, projectAccessWhere, taskAccessWhere } from "@/lib/permissions/scopes";
import { buildTaskSummary } from "@/lib/whatsapp";
import { buildTaskWhere } from "@/modules/tasks/filters";
import { listTasksForReport, type TaskListRow } from "@/modules/tasks/service";
import { taskListQuerySchema } from "@/modules/tasks/validation";

export const REPORT_TYPES = ["task", "project", "department", "member", "global"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

const reportParamsSchema = z.object({ type: z.enum(REPORT_TYPES), id: z.string().uuid().optional() });

export type ReportData = {
  type: ReportType;
  title: string;
  subject: string;
  details: { label: string; value: string }[];
  organization: { name: string; logoDataUrl: string | null; address: string | null };
  generatedAt: Date;
  generatedBy: string;
  tasks: TaskListRow[];
  truncated: boolean;
  whatsappPhone: string | null;
  fileName: string;
};

const LIMIT = 2000;

/**
 * Builds a report. Authorization: the subject must be visible to the actor, the
 * actor needs reports.view (or reports.own for their own list / a visible task),
 * and the task list is always intersected with the actor's task scope.
 */
export async function getReport(actor: Actor & { fullName: string }, params: Record<string, string | string[] | undefined>): Promise<ReportData> {
  const parsed = reportParamsSchema.safeParse({ type: params.type, id: params.id });
  if (!parsed.success) throw new ValidationError("Invalid report request.");
  const { type, id } = parsed.data;
  if (type !== "global" && !id) throw new ValidationError("Missing report subject.");
  const canView = can(actor, "reports.view");
  const canOwn = can(actor, "reports.own");
  if (!canView && !canOwn) throw new ForbiddenError();

  const org = await db.organization.findUniqueOrThrow({ where: { id: actor.organizationId }, select: { name: true, logoDataUrl: true, address: true } });
  const base = { organization: org, generatedAt: new Date(), generatedBy: actor.fullName, type };
  let filter: Prisma.TaskWhereInput = {};
  let meta: Pick<ReportData, "title" | "subject" | "details" | "whatsappPhone" | "fileName">;

  switch (type) {
    case "task": {
      const task = await db.task.findFirst({ where: { AND: [taskAccessWhere(actor), { id }] }, select: { id: true, code: true, title: true, project: { select: { name: true } } } });
      if (!task) throw new NotFoundError("Task");
      filter = { id: task.id };
      meta = { title: "Task Report", subject: `${task.code} — ${task.title}`, details: [{ label: "Project", value: task.project.name }], whatsappPhone: null, fileName: `task-${task.code}` };
      break;
    }
    case "project": {
      if (!canView) throw new ForbiddenError();
      const project = await db.project.findFirst({ where: { AND: [projectAccessWhere(actor), { id }] }, include: { manager: { select: { fullName: true } } } });
      if (!project) throw new NotFoundError("Project");
      filter = { projectId: project.id };
      meta = {
        title: "Project Task List",
        subject: `${project.name} (${project.code})`,
        details: [
          { label: "Site address", value: project.siteAddress },
          { label: "Status", value: project.status.replace("_", " ") },
          { label: "Project manager", value: project.manager?.fullName ?? "—" },
        ],
        whatsappPhone: null,
        fileName: `project-${project.code}-tasks`,
      };
      break;
    }
    case "department": {
      if (!canView) throw new ForbiddenError();
      const dept = await db.department.findFirst({ where: { id, organizationId: actor.organizationId }, include: { head: { select: { fullName: true } } } });
      if (!dept) throw new NotFoundError("Department");
      filter = { departments: { some: { departmentId: dept.id } } };
      meta = { title: "Department Task List", subject: `${dept.name} (${dept.code})`, details: [{ label: "Department head", value: dept.head?.fullName ?? "—" }], whatsappPhone: null, fileName: `department-${dept.code}-tasks` };
      break;
    }
    case "member": {
      const isSelf = id === actor.id;
      if (!canView && !(isSelf && canOwn)) throw new ForbiddenError();
      const member = await db.user.findFirst({
        where: { AND: [memberAccessWhere(actor), { id }] },
        select: { id: true, fullName: true, employeeCode: true, designation: true, whatsappNumber: true, phone: true, primaryDepartment: { select: { name: true } } },
      });
      if (!member) throw new NotFoundError("Team member");
      filter = { assignees: { some: { userId: member.id } } };
      meta = {
        title: "Team Member Task List",
        subject: `${member.fullName} (${member.employeeCode})`,
        details: [
          { label: "Designation", value: member.designation ?? "—" },
          { label: "Primary department", value: member.primaryDepartment?.name ?? "—" },
        ],
        whatsappPhone: member.whatsappNumber ?? member.phone ?? null,
        fileName: `member-${member.employeeCode}-tasks`,
      };
      break;
    }
    case "global": {
      if (!canView) throw new ForbiddenError();
      const query = taskListQuerySchema.parse(params);
      filter = buildTaskWhere(actor, query);
      const applied = Object.entries(query).filter(([k, v]) => v !== undefined && !["sort", "dir", "page", "pageSize"].includes(k)).length;
      meta = { title: "Task Register", subject: applied ? "Filtered task list" : "All accessible tasks", details: [], whatsappPhone: null, fileName: "task-register" };
      break;
    }
  }

  const tasks = await listTasksForReport(actor, filter, LIMIT + 1);
  return { ...base, ...meta, tasks: tasks.slice(0, LIMIT), truncated: tasks.length > LIMIT };
}

export function reportWhatsAppText(report: ReportData): string {
  return buildTaskSummary({
    heading: `${report.organization.name} — ${report.title}`,
    subheading: report.subject,
    tasks: report.tasks,
    showProject: report.type !== "project",
    showAssignees: report.type !== "member",
    footer: `Generated ${report.generatedAt.toISOString().slice(0, 10).split("-").reverse().join("/")} by ${report.generatedBy}`,
  });
}
