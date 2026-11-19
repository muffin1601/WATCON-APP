import type { Metadata } from "next";
import { AddBrandButton } from "@/components/inventory/brand-form";
import { BrandsTable } from "@/components/inventory/tables";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar, FilterSelect, SearchInput } from "@/components/tables/filters";
import { Pagination } from "@/components/tables/pagination";
import { requirePagePermission } from "@/lib/auth/session";
import { inventoryCapabilities, listBrands } from "@/modules/inventory/service";

export const metadata: Metadata = { title: "Brands" };

export default async function BrandsPage({ searchParams }: PageProps<"/brands">) {
  const user = await requirePagePermission("items.view");
  const result = await listBrands(user, await searchParams);
  const { canManage } = inventoryCapabilities(user);

  return (
    <>
      <PageHeader
        title="Brands"
        description="Brands that items can be stocked in. Each item–brand pair has its own stock balance."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Brands" }]}
        actions={canManage && <AddBrandButton />}
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
      <BrandsTable rows={result.rows} canManage={canManage} />
      <Pagination total={result.total} page={result.page} pageSize={result.pageSize} />
    </>
  );
}
