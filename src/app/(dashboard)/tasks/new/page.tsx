import { FolderKanban } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { TaskForm } from "@/components/tasks/task-form";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions/definitions";
import { listDepartmentOptions } from "@/modules/departments/service";
import { listMemberOptions } from "@/modules/members/service";
import { listProjectOptions } from "@/modules/projects/service";

export const metadata: Metadata = { title: "Create task" };

export default async function NewTaskPage({ searchParams }: PageProps<"/tasks/new">) {
  const user = await requirePagePermission("tasks.create");
  const sp = await searchParams;
  const [projects, departments, people] = await Promise.all([
    listProjectOptions(user, { forTaskCreation: true }),
    listDepartmentOptions(user, { activeOnly: true }),
    listMemberOptions(user),
  ]);
  const requested = typeof sp.projectId === "string" ? sp.projectId : undefined;
  const preselected = projects.find((p) => p.id === requested);

  return (
    <>
      <PageHeader
        title="Create task"
        description={preselected ? `New task for ${preselected.name}` : "Create a task and assign it to departments and team members."}
        breadcrumbs={preselected ? [{ label: "Projects", href: "/projects" }, { label: preselected.code, href: `/projects/${preselected.id}` }, { label: "New task" }] : [{ label: "Tasks", href: "/tasks" }, { label: "New" }]}
      />
      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects available"
          description="Tasks belong to a project. Create a project first, or ask an administrator to add you to one."
          action={
            can(user, "projects.create") ? (
              <Button asChild>
                <Link href="/projects/new">Create project</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <TaskForm projects={projects} departments={departments} people={people} defaults={{ projectId: preselected?.id ?? "" }} />
      )}
    </>
  );
}
