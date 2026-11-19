import type { Metadata } from "next";
import { AddItemButton } from "@/components/inventory/item-form";
import { PostMovementButton } from "@/components/inventory/movement-form";
import { ItemsTable } from "@/components/inventory/tables";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar, FilterSelect, SearchInput } from "@/components/tables/filters";
import { Pagination } from "@/components/tables/pagination";
import { requirePagePermission } from "@/lib/auth/session";
import { todayString } from "@/modules/inventory/serialize";
import { inventoryCapabilities, listItemCategories, listItems, listStockPositionOptions } from "@/modules/inventory/service";

export const metadata: Metadata = { title: "Items" };

export default async function ItemsPage({ searchParams }: PageProps<"/items">) {
  const user = await requirePagePermission("items.view");
  const sp = await searchParams;
  const caps = inventoryCapabilities(user);
  const [result, categories, positions] = await Promise.all([listItems(user, sp), listItemCategories(user), listStockPositionOptions(user)]);

  return (
    <>
      <PageHeader
        title="Items"
        description="Item master with brand-wise stock."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Items" }]}
        actions={
          <>
            <PostMovementButton positions={positions} canPost={caps.canPost} canAdjust={caps.canAdjust} today={todayString()} variant="outline" />
            {caps.canManage && <AddItemButton categories={categories} defaultOpen={sp.new === "1"} />}
          </>
        }
      />
      <FilterBar params={["q", "category", "status"]}>
        <SearchInput placeholder="Search name, code, category, brand…" />
        <FilterSelect param="category" label="Category" options={categories.map((c) => ({ value: c, label: c }))} />
        <FilterSelect
          param="status"
          label="Status"
          options={[
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
          ]}
        />
      </FilterBar>
      <ItemsTable rows={result.rows} canManage={caps.canManage} categories={categories} />
      <Pagination total={result.total} page={result.page} pageSize={result.pageSize} />
    </>
  );
}
