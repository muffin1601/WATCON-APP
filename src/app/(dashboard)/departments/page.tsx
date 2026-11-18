import type { Metadata } from "next";
import { AddDepartmentButton } from "@/components/departments/department-form";
import { DepartmentsTable } from "@/components/departments/departments-table";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar, FilterSelect, SearchInput } from "@/components/tables/filters";
import { Pagination } from "@/components/tables/pagination";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions/definitions";
import { listDepartments } from "@/modules/departments/service";
import { listMemberOptions } from "@/modules/members/service";

export const metadata: Metadata = { title: "Departments" };

export default async function DepartmentsPage({ searchParams }: PageProps<"/departments">) {
  const user = await requireUser();
  const sp = await searchParams;
  const canManage = can(user, "departments.manage");
  const [result, people] = await Promise.all([listDepartments(user, sp), canManage ? listMemberOptions(user) : Promise.resolve([])]);

  return (
    <>
      <PageHeader
        title="Departments"
        description="Company departments, their members and assigned work."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Departments" }]}
        actions={canManage && <AddDepartmentButton people={people} defaultOpen={sp.new === "1"} />}
      />
      <FilterBar params={["q", "status"]}>
        <SearchInput placeholder="Search name or code…" />
        <FilterSelect
          param="status"
          label="Status"
          options={[
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
          ]}
        />
      </FilterBar>
      <DepartmentsTable
        canManage={canManage}
        people={people}
        rows={result.rows.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          description: r.description,
          headId: r.head?.id ?? null,
          head: r.head?.fullName ?? null,
          status: r.status,
          memberCount: r.memberCount,
          taskCount: r.taskCount,
          pendingCount: r.pendingCount,
          completedCount: r.completedCount,
        }))}
      />
      <Pagination total={result.total} page={result.page} pageSize={result.pageSize} />
    </>
  );
}
