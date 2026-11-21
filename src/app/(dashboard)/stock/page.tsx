import { listCrumbs, lockedProject } from "@/components/procurement/crumbs";
import type { Metadata } from "next";
import { LedgerWithActions } from "@/components/inventory/ledger-with-actions";
import { LocationBalancesTable, LocationDialog, LocationsTable, ReservationsTable, ReserveStockButton } from "@/components/inventory/location-ui";
import { PostMovementButton } from "@/components/inventory/movement-form";
import { StockTable } from "@/components/inventory/tables";
import { PageHeader } from "@/components/shared/page-header";
import { UrlTabs } from "@/components/shared/url-tabs";
import { DateRangeFilter, FilterBar, FilterSelect, SearchInput } from "@/components/tables/filters";
import { Pagination } from "@/components/tables/pagination";
import { requirePagePermission } from "@/lib/auth/session";
import { STOCK_TXN_LABELS } from "@/modules/inventory/rules";
import { toLedgerRow, todayString } from "@/modules/inventory/serialize";
import { getLedger, getStockSummary, inventoryCapabilities, listBrandOptions, listItemCategories, listStockPositionOptions } from "@/modules/inventory/service";
import { listLocationBalances, listLocationOptions, listLocations, listReservations, locationCapabilities } from "@/modules/inventory/locations";
import { listProjectOptions } from "@/modules/projects/service";

export const metadata: Metadata = { title: "Inventory" };

const TABS = ["summary", "locations-stock", "ledger", "reservations", "locations"] as const;

export default async function StockPage({ searchParams }: PageProps<"/stock">) {
  const user = await requirePagePermission("items.view");
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(String(sp.tab)) ? (String(sp.tab) as (typeof TABS)[number]) : "summary";
  const caps = { ...inventoryCapabilities(user), ...locationCapabilities(user) };
  const [brands, categories, positions, locations, projects] = await Promise.all([listBrandOptions(user), listItemCategories(user), listStockPositionOptions(user), listLocationOptions(user), listProjectOptions(user, { forTaskCreation: true })]);
  const locked = lockedProject(projects, sp);
  const brandFilter = <FilterSelect param="brandId" label="Brand" options={brands.map((b) => ({ value: b.id, label: b.name }))} />;
  const locationFilter = <FilterSelect param="locationId" label="Location" options={locations.map((l) => ({ value: l.id, label: l.name }))} />;

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Item–brand stock by location, reservations and the complete stock movement ledger."
        breadcrumbs={listCrumbs(locked, "stock")}
        actions={
          <>
            {caps.canReserve && <ReserveStockButton projects={projects} positions={positions} locations={locations} />}
            <PostMovementButton positions={positions} locations={locations} canPost={caps.canPost} canAdjust={caps.canAdjust} today={todayString()} />
          </>
        }
      />
      <UrlTabs
        current={tab}
        tabs={[
          { key: "summary", label: "Company stock" },
          { key: "locations-stock", label: "By location" },
          { key: "ledger", label: "Stock ledger" },
          { key: "reservations", label: "Reservations" },
          { key: "locations", label: "Locations" },
        ]}
      />
      {tab === "summary" && (
        <Summary sp={sp} brandFilter={brandFilter} categories={categories} user={user} />
      )}
      {tab === "locations-stock" && <ByLocation sp={sp} brandFilter={brandFilter} locationFilter={locationFilter} user={user} />}
      {tab === "ledger" && <Ledger sp={sp} brandFilter={brandFilter} locationFilter={locationFilter} user={user} canReverse={caps.canReverse} />}
      {tab === "reservations" && <Reservations user={user} canRelease={caps.canReserve} />}
      {tab === "locations" && <Locations user={user} canManage={caps.canManageLocations} projects={projects} />}
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
      <p className="mb-2 text-xs text-muted-foreground">Company-wide totals per item–brand across all locations (including goods in transit). Opening includes opening entries and all movements before the period start.</p>
      <StockTable rows={result.rows} />
      <Pagination total={result.total} page={result.page} pageSize={result.pageSize} />
    </>
  );
}

async function ByLocation({ sp, brandFilter, locationFilter, user }: { sp: Sp; brandFilter: React.ReactNode; locationFilter: React.ReactNode; user: User }) {
  const result = await listLocationBalances(user, sp);
  return (
    <>
      <FilterBar params={["q", "brandId", "locationId", "nonZero"]}>
        <SearchInput placeholder="Search item, code or brand…" />
        {locationFilter}
        {brandFilter}
        <FilterSelect param="nonZero" label="Balances" allLabel="In stock only" options={[{ value: "0", label: "Include zero balances" }]} />
      </FilterBar>
      <p className="mb-2 text-xs text-muted-foreground">Available = on hand − reserved (open reservations for projects). Balances are maintained by the posting engine, never by the browser.</p>
      <LocationBalancesTable rows={result.rows} />
      <Pagination total={result.total} page={result.page} pageSize={result.pageSize} />
    </>
  );
}

async function Ledger({ sp, brandFilter, locationFilter, user, canReverse }: { sp: Sp; brandFilter: React.ReactNode; locationFilter: React.ReactNode; user: User; canReverse: boolean }) {
  const result = await getLedger(user, sp);
  return (
    <>
      <FilterBar params={["q", "brandId", "itemId", "type", "locationId", "from", "to"]}>
        <SearchInput placeholder="Search entry, reference, item…" />
        {locationFilter}
        {brandFilter}
        <FilterSelect param="type" label="Type" options={Object.entries(STOCK_TXN_LABELS).map(([value, label]) => ({ value, label }))} />
        <DateRangeFilter fromParam="from" toParam="to" label="Date" />
      </FilterBar>
      <LedgerWithActions rows={result.rows.map(toLedgerRow)} canReverse={canReverse} />
      <Pagination total={result.total} page={result.page} pageSize={result.pageSize} />
    </>
  );
}

async function Reservations({ user, canRelease }: { user: User; canRelease: boolean }) {
  const rows = await listReservations(user);
  return <ReservationsTable rows={rows} canRelease={canRelease} />;
}

async function Locations({ user, canManage, projects }: { user: User; canManage: boolean; projects: { id: string; code: string; name: string }[] }) {
  const rows = await listLocations(user);
  return (
    <>
      {canManage && (
        <div className="mb-3 flex justify-end">
          <LocationDialog projects={projects} />
        </div>
      )}
      <p className="mb-2 text-xs text-muted-foreground">Each project gets a site store automatically when material is first sent or delivered there. In-transit and quarantine are system locations used by transfers and damaged stock.</p>
      <LocationsTable rows={rows.map((r) => ({ id: r.id, code: r.code, name: r.name, type: r.type, isSystem: r.isSystem, status: r.status, address: r.address, project: r.project, positions: r.positions }))} canManage={canManage} projects={projects} />
    </>
  );
}
