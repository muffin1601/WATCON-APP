import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PartiesTable } from "@/components/parties/parties-table";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar, FilterSelect, SearchInput } from "@/components/tables/filters";
import { Pagination } from "@/components/tables/pagination";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/auth/session";
import { listParties, partyCapabilities } from "@/modules/parties/service";

export const metadata: Metadata = { title: "Clients & suppliers" };

export default async function PartiesPage({ searchParams }: PageProps<"/parties">) {
  const user = await requirePagePermission("parties.view");
  const sp = await searchParams;
  const result = await listParties(user, sp);
  const caps = partyCapabilities(user);
  const title = result.query.type === "client" ? "Clients" : result.query.type === "supplier" ? "Suppliers" : "Clients & suppliers";
  return (
    <>
      <PageHeader
        title={title}
        description="Party master with GST registration, payment terms, TDS defaults and bank details."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: title }]}
        actions={
          caps.canManage && (
            <Button asChild size="sm">
              <Link href={`/parties/new${result.query.type ? `?type=${result.query.type}` : ""}`}>
                <Plus /> Add {result.query.type ?? "party"}
              </Link>
            </Button>
          )
        }
      />
      <FilterBar params={["q", "type", "status"]}>
        <SearchInput placeholder="Search name, code, GSTIN, city…" />
        <FilterSelect
          param="type"
          label="Type"
          options={[
            { value: "client", label: "Clients" },
            { value: "supplier", label: "Suppliers" },
          ]}
        />
        <FilterSelect
          param="status"
          label="Status"
          options={[
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
          ]}
        />
      </FilterBar>
      <PartiesTable rows={result.rows} />
      <Pagination total={result.total} page={result.page} pageSize={result.pageSize} />
    </>
  );
}
