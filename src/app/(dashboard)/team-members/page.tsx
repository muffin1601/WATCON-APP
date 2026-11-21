import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MembersTable } from "@/components/members/members-table";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar, FilterSelect, SearchInput } from "@/components/tables/filters";
import { Pagination } from "@/components/tables/pagination";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/auth/session";
import { ROLE_LABELS, can } from "@/lib/permissions/definitions";
import { listDepartmentOptions } from "@/modules/departments/service";
import { listMembers } from "@/modules/members/service";

export const metadata: Metadata = { title: "Team Members" };

export default async function TeamMembersPage({ searchParams }: PageProps<"/team-members">) {
  const user = await requirePagePermission("members.view");
  const [result, departments] = await Promise.all([listMembers(user, await searchParams), listDepartmentOptions(user)]);
  const canCreate = can(user, "members.manage");
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  return (
    <>
      <PageHeader
        title="Team Members"
        description="Employees, their departments and workload."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Team Members" }]}
        actions={
          canCreate && (
            <Button asChild>
              <Link href="/team-members/new">
                <Plus /> Add member
              </Link>
            </Button>
          )
        }
      />
      <FilterBar params={["q", "departmentId", "role", "status"]}>
        <SearchInput placeholder="Search name, ID, email…" />
        <FilterSelect param="departmentId" label="Department" options={departments.map((d) => ({ value: d.id, label: d.name }))} />
        <FilterSelect param="role" label="Role" options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))} />
        <FilterSelect
          param="status"
          label="Status"
          options={[
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
          ]}
        />
      </FilterBar>
      <MembersTable
        canCreate={canCreate}
        rows={result.rows.map((r) => ({
          id: r.id,
          employeeCode: r.employeeCode,
          fullName: r.fullName,
          designation: r.designation,
          email: r.email,
          phone: r.phone,
          status: r.status,
          role: r.role.name,
          roleKey: r.role.key,
          primaryDepartment: r.primaryDepartment?.name ?? r.departmentMembership[0]?.department.name ?? null,
          otherDepartments: Math.max(0, r.departmentMembership.length - 1),
          activeTasks: r.activeTasks,
          completedTasks: r.completedTasks,
          // UI hint only; the service re-checks every mutation.
          canManage: isSuperAdmin || (canCreate && r.role.key !== "ADMIN" && r.role.key !== "SUPER_ADMIN"),
          isSelf: r.id === user.id,
        }))}
      />
      <Pagination total={result.total} page={result.page} pageSize={result.pageSize} />
    </>
  );
}
