import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProjectForm } from "@/components/projects/project-form";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/errors";
import { fromDbDate } from "@/lib/validations/common";
import { listMemberOptions } from "@/modules/members/service";
import { getProject } from "@/modules/projects/service";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: PageProps<"/projects/[projectId]/edit">) {
  const { projectId } = await params;
  const user = await requirePagePermission("projects.edit");
  const data = await getProject(user, projectId).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  if (!data.capabilities.canEdit) redirect(`/projects/${projectId}`);
  const { project } = data;
  const people = await listMemberOptions(user);
  return (
    <>
      <PageHeader title={`Edit ${project.name}`} breadcrumbs={[{ label: "Projects", href: "/projects" }, { label: project.code, href: `/projects/${project.id}` }, { label: "Edit" }]} />
      <ProjectForm
        people={people}
        projectId={project.id}
        code={project.code}
        defaults={{
          name: project.name,
          siteAddress: project.siteAddress,
          description: project.description,
          startDate: fromDbDate(project.startDate),
          expectedCompletionDate: fromDbDate(project.expectedCompletionDate),
          priority: project.priority,
          status: project.status,
          managerId: project.managerId,
          memberIds: project.members.map((m) => m.userId),
        }}
      />
    </>
  );
}
