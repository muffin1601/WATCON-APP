import type { Metadata } from "next";
import { ProjectForm } from "@/components/projects/project-form";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { listMemberOptions } from "@/modules/members/service";

export const metadata: Metadata = { title: "Create project" };

export default async function NewProjectPage() {
  const user = await requirePagePermission("projects.create");
  const people = await listMemberOptions(user);
  return (
    <>
      <PageHeader title="Create new project" description="Register a new company site." breadcrumbs={[{ label: "Projects", href: "/projects" }, { label: "New" }]} />
      <ProjectForm people={people} />
    </>
  );
}
