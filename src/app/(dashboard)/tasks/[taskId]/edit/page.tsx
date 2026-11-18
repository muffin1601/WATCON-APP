import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { TaskForm } from "@/components/tasks/task-form";
import { requirePagePermission } from "@/lib/auth/session";
import { orNotFound } from "@/lib/pages";
import { fromDbDate } from "@/lib/validations/common";
import { listDepartmentOptions } from "@/modules/departments/service";
import { listMemberOptions } from "@/modules/members/service";
import { listProjectOptions } from "@/modules/projects/service";
import { getTask } from "@/modules/tasks/service";

export const metadata: Metadata = { title: "Edit task" };

export default async function EditTaskPage({ params }: PageProps<"/tasks/[taskId]/edit">) {
  const { taskId } = await params;
  const user = await requirePagePermission("tasks.manage");
  const { task, capabilities } = await orNotFound(getTask(user, taskId));
  if (!capabilities.canEdit) redirect(`/tasks/${taskId}`);

  const [projectOptions, allDepartments, activePeople] = await Promise.all([listProjectOptions(user, { forTaskCreation: true }), listDepartmentOptions(user), listMemberOptions(user)]);

  // Keep the current project selectable even if it is no longer open for new tasks.
  const projects = projectOptions.some((p) => p.id === task.project.id) ? projectOptions : [{ id: task.project.id, code: task.project.code, name: task.project.name }, ...projectOptions];
  // Active departments plus any inactive ones already assigned (shown, but cannot be newly picked).
  const assignedDepartmentIds = new Set(task.departments.map((d) => d.departmentId));
  const departments = allDepartments.filter((d) => d.status === "ACTIVE" || assignedDepartmentIds.has(d.id));
  // Active people plus currently assigned inactive people so they still display.
  const people = [
    ...activePeople,
    ...task.assignees
      .filter((a) => !activePeople.some((p) => p.id === a.userId))
      .map((a) => ({ id: a.user.id, fullName: `${a.user.fullName} (inactive)`, employeeCode: "", designation: a.user.designation, departmentIds: [] })),
  ];

  return (
    <>
      <PageHeader title={`Edit ${task.code}`} description={task.title} breadcrumbs={[{ label: "Tasks", href: "/tasks" }, { label: task.code, href: `/tasks/${task.id}` }, { label: "Edit" }]} />
      <TaskForm
        projects={projects}
        departments={departments}
        people={people}
        taskId={task.id}
        version={task.version}
        code={task.code}
        defaults={{
          title: task.title,
          description: task.description ?? "",
          projectId: task.projectId,
          departmentIds: task.departments.map((d) => d.departmentId),
          assigneeIds: task.assignees.map((a) => a.userId),
          ownerId: task.ownerId,
          startDate: fromDbDate(task.startDate),
          dueDate: fromDbDate(task.dueDate),
          priority: task.priority,
          status: task.status,
          progress: task.progress,
        }}
      />
    </>
  );
}
