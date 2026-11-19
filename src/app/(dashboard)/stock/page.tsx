import type { Metadata } from "next";
import { PostMovementButton } from "@/components/inventory/movement-form";
import { LedgerTable, StockTable } from "@/components/inventory/tables";
import { PageHeader } from "@/components/shared/page-header";
import { UrlTabs } from "@/components/shared/url-tabs";
import { DateRangeFilter, FilterBar, FilterSelect, SearchInput } from "@/components/tables/filters";
import { Pagination } from "@/components/tables/pagination";
import { requirePagePermission } from "@/lib/auth/session";
import { toLedgerRow, todayString } from "@/modules/inventory/serialize";
import { getLedger, getStockSummary, inventoryCapabilities, listBrandOptions, listItemCategories, listStockPositionOptions } from "@/modules/inventory/service";

export const metadata: Metadata = { title: "Stock" };

export default async function StockPage({ searchParams }: PageProps<"/stock">) {
  const user = await requirePagePermission("items.view");
  const sp = await searchParams;
  const tab = sp.tab === "ledger" ? "ledger" : "summary";
  const caps = inventoryCapabilities(user);
  const [brands, categories, positions] = await Promise.all([listBrandOptions(user), listItemCategories(user), listStockPositionOptions(user)]);
  const brandFilter = <FilterSelect param="brandId" label="Brand" options={brands.map((b) => ({ value: b.id, label: b.name }))} />;

  return (
    <>
      <PageHeader
        title="Stock"
        description="Brand-wise balances and the complete stock ledger."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Stock" }]}
        actions={<PostMovementButton positions={positions} canPost={caps.canPost} canAdjust={caps.canAdjust} today={todayString()} />}
      />
      <UrlTabs
        current={tab}
        tabs={[
          { key: "summary", label: "Brand-wise stock" },
          { key: "ledger", label: "Ledger" },
        ]}
      />
      {tab === "summary" ? <Summary sp={sp} brandFilter={brandFilter} categories={categories} user={user} /> : <Ledger sp={sp} brandFilter={brandFilter} user={user} />}
    </>
  );
}

type Sp = Awaited<PageProps<"/stock">["searchParams"]>;
type User = Awaited<ReturnType<typeof requirePagePermission>>;

async function Summary({ sp, brandFilter, categories, user }: { sp: Sp; brandFilter: React.ReactNode; categories: string[]; user: User }) {
  const result = await getStockSummary(user, sp);
  return (
    <>
      <FilterBar params={["q", "brandId", "category", "itemId", "from", "to"]}>
        <SearchInput placeholder="Search item, code or brand…" />
        {brandFilter}
        <FilterSelect param="category" label="Category" options={categories.map((c) => ({ value: c, label: c }))} />
        <DateRangeFilter fromParam="from" toParam="to" label="Period" />
      </FilterBar>
      <p className="mb-2 text-xs text-muted-foreground">Opening includes opening entries and all movements before the period start. Without a period, closing equals the current balance.</p>
      <StockTable rows={result.rows} />
      <Pagination total={result.total} page={result.page} pageSize={result.pageSize} />
    </>
  );
}

async function Ledger({ sp, brandFilter, user }: { sp: Sp; brandFilter: React.ReactNode; user: User }) {
  const result = await getLedger(user, sp);
  return (
    <>
      <FilterBar params={["q", "brandId", "itemId", "type", "from", "to"]}>
        <SearchInput placeholder="Search entry, reference, item…" />
        {brandFilter}
        <FilterSelect
          param="type"
          label="Type"
          options={[
            { value: "OPENING", label: "Opening" },
            { value: "INWARD", label: "Inward" },
            { value: "OUTWARD", label: "Outward" },
            { value: "ADJUSTMENT", label: "Adjustment" },
          ]}
        />
        <DateRangeFilter fromParam="from" toParam="to" label="Date" />
      </FilterBar>
      <LedgerTable rows={result.rows.map(toLedgerRow)} />
      <Pagination total={result.total} page={result.page} pageSize={result.pageSize} />
    </>
  );
}
