import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MemberForm } from "@/components/members/member-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/session";
import { orNotFound } from "@/lib/pages";
import { can } from "@/lib/permissions/definitions";
import { fromDbDate } from "@/lib/validations/common";
import { listDepartmentOptions } from "@/modules/departments/service";
import { getMember } from "@/modules/members/service";

export const metadata: Metadata = { title: "Edit team member" };

export default async function EditMemberPage({ params }: PageProps<"/team-members/[memberId]/edit">) {
  const { memberId } = await params;
  const user = await requireUser();
  const { member, capabilities } = await orNotFound(getMember(user, memberId));
  if (!capabilities.canEdit) redirect(`/team-members/${memberId}`);
  const departments = await listDepartmentOptions(user);
  const primary = member.primaryDepartmentId;
  return (
    <>
      <PageHeader
        title={`Edit ${member.fullName}`}
        breadcrumbs={[{ label: "Team Members", href: "/team-members" }, { label: member.employeeCode, href: `/team-members/${member.id}` }, { label: "Edit" }]}
      />
      <MemberForm
        departments={departments}
        memberId={member.id}
        employeeCode={member.employeeCode}
        canAssignAdmin={can(user, "users.manage_admins")}
        defaults={{
          fullName: member.fullName,
          email: member.email,
          username: member.username,
          phone: member.phone ?? "",
          whatsappNumber: member.whatsappNumber ?? "",
          designation: member.designation ?? "",
          joiningDate: fromDbDate(member.joiningDate),
          role: member.role.key,
          primaryDepartmentId: primary,
          additionalDepartmentIds: member.departmentMembership.map((m) => m.department.id).filter((id) => id !== primary),
        }}
      />
    </>
  );
}
