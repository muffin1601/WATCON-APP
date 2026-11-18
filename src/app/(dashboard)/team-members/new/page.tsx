import type { Metadata } from "next";
import { MemberForm } from "@/components/members/member-form";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions/definitions";
import { listDepartmentOptions } from "@/modules/departments/service";

export const metadata: Metadata = { title: "Add team member" };

export default async function NewMemberPage() {
  const user = await requirePagePermission("members.manage");
  const departments = await listDepartmentOptions(user);
  return (
    <>
      <PageHeader title="Add team member" description="Creates the employee profile and their sign-in account." breadcrumbs={[{ label: "Team Members", href: "/team-members" }, { label: "New" }]} />
      <MemberForm departments={departments} canAssignAdmin={can(user, "users.manage_admins")} />
    </>
  );
}
