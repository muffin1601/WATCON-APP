import { History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EditItemButton } from "@/components/inventory/item-form";
import { LinkBrandButton, UnlinkBrandButton } from "@/components/inventory/link-brand-form";
import { PostMovementButton } from "@/components/inventory/movement-form";
import { InventoryStatusConfirm } from "@/components/inventory/status-confirm";
import { LedgerTable } from "@/components/inventory/tables";
import { RecordStatusBadge } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/states";
import { DateRangeFilter, FilterBar, FilterSelect } from "@/components/tables/filters";
import { Pagination } from "@/components/tables/pagination";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePagePermission } from "@/lib/auth/session";
import { formatDateTime, formatQty } from "@/lib/format";
import { orNotFound } from "@/lib/pages";
import { fromMilli, toMilli } from "@/modules/inventory/rules";
import { toLedgerRow, todayString } from "@/modules/inventory/serialize";
import { getItem, listBrandOptions, listItemCategories } from "@/modules/inventory/service";

export const metadata: Metadata = { title: "Item" };

const num = "text-right tabular-nums whitespace-nowrap";

export default async function ItemDetailPage({ params, searchParams }: PageProps<"/items/[itemId]">) {
  const { itemId } = await params;
  const sp = await searchParams;
  const user = await requirePagePermission("items.view");
  const { item, positions, ledger, capabilities: caps } = await orNotFound(getItem(user, itemId, sp));
  const [brands, categories] = caps.canManage ? await Promise.all([listBrandOptions(user), listItemCategories(user)]) : [[], []];
  const today = todayString();
  const linked = new Set(positions.map((p) => p.brand.id));
  const total = (key: "opening" | "inward" | "outward" | "closing") => fromMilli(positions.reduce((s, p) => s + toMilli(p[key]), BigInt(0)));
  const active = item.status === "ACTIVE";
  const movable = active ? positions.filter((p) => p.brand.status === "ACTIVE") : [];
  const options = movable.map((p) => ({ id: p.id, itemCode: item.code, itemName: item.name, brandName: p.brand.name, unit: item.unit, currentQty: p.currentQty }));

  return (
    <>
      <PageHeader
        title={item.name}
        breadcrumbs={[{ label: "Items", href: "/items" }, { label: item.code }]}
        meta={
          <>
            <span className="font-mono text-xs text-muted-foreground">{item.code}</span>
            <RecordStatusBadge status={item.status} />
            {item.category && <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">{item.category}</span>}
            <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">Unit: {item.unit}</span>
          </>
        }
        actions={
          <>
            {caps.canManage && <EditItemButton item={item} categories={categories} />}
            {caps.canManage && <InventoryStatusConfirm kind="item" id={item.id} name={item.name} status={item.status} />}
            <PostMovementButton positions={options} canPost={caps.canPost} canAdjust={caps.canAdjust} today={today} />
          </>
        }
      />

      {item.images.length > 0 && (
        <div className="mb-6 flex gap-3 overflow-x-auto" aria-label="Product images">
          {item.images.map((img) => (
            <a key={img.id} href={img.path} target="_blank" rel="noreferrer" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- static files from /public */}
              <img src={img.path} alt={item.name} loading="lazy" className="size-36 rounded-lg border bg-white object-contain" />
            </a>
          ))}
        </div>
      )}

      {item.description && <p className="mb-6 max-w-3xl text-sm whitespace-pre-line text-muted-foreground">{item.description}</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Brands" value={positions.length} />
        <StatCard label={`Total stock (${item.unit})`} value={formatQty(total("closing"))} tone="info" />
        <StatCard label="Inward (all time)" value={formatQty(total("inward"))} tone="success" />
        <StatCard label="Outward (all time)" value={formatQty(total("outward"))} tone="danger" />
      </div>

      <section className="mb-8" aria-labelledby="brand-stock">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="brand-stock" className="text-base font-semibold">
            Brand-wise stock
          </h2>
          {caps.canManage && active && <LinkBrandButton itemId={item.id} unit={item.unit} brands={brands.filter((b) => !linked.has(b.id) && b.status === "ACTIVE")} canAdjust={caps.canAdjust} today={today} />}
        </div>
        {positions.length === 0 ? (
          <EmptyState title="No brands linked" description={caps.canManage ? "Add a brand to start tracking stock for this item." : "No brand of this item is stocked yet."} />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-xs">Brand</TableHead>
                    <TableHead className={`text-xs ${num}`}>Opening</TableHead>
                    <TableHead className={`text-xs ${num}`}>Inward</TableHead>
                    <TableHead className={`text-xs ${num}`}>Outward</TableHead>
                    <TableHead className={`text-xs ${num}`}>Closing</TableHead>
                    <TableHead className="w-24">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {p.brand.name}
                        {p.brand.status !== "ACTIVE" && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(inactive)</span>}
                      </TableCell>
                      <TableCell className={num}>{formatQty(p.opening)}</TableCell>
                      <TableCell className={`${num} text-emerald-700`}>{formatQty(p.inward)}</TableCell>
                      <TableCell className={`${num} text-rose-700`}>{formatQty(p.outward)}</TableCell>
                      <TableCell className={`${num} font-semibold`}>{formatQty(p.closing)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon-sm" aria-label={`Ledger for ${p.brand.name}`}>
                            <Link href={`/items/${item.id}?brandId=${p.brand.id}#ledger`} scroll={false}>
                              <History />
                            </Link>
                          </Button>
                          {caps.canManage && p.transactionCount === 0 && <UnlinkBrandButton id={p.id} brandName={p.brand.name} />}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="hover:bg-transparent">
                    <TableCell className="font-medium">Total</TableCell>
                    <TableCell className={num}>{formatQty(total("opening"))}</TableCell>
                    <TableCell className={num}>{formatQty(total("inward"))}</TableCell>
                    <TableCell className={num}>{formatQty(total("outward"))}</TableCell>
                    <TableCell className={`${num} font-semibold`}>
                      {formatQty(total("closing"))} {item.unit}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </div>
        )}
      </section>

      <section id="ledger" aria-labelledby="item-ledger" className="scroll-mt-20">
        <h2 id="item-ledger" className="mb-3 text-base font-semibold">
          Stock ledger
        </h2>
        <FilterBar params={["brandId", "type", "from", "to"]}>
          <FilterSelect param="brandId" label="Brand" options={positions.map((p) => ({ value: p.brand.id, label: p.brand.name }))} />
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
        <LedgerTable rows={ledger.rows.map(toLedgerRow)} showItem={false} />
        <Pagination total={ledger.total} page={ledger.page} pageSize={ledger.pageSize} />
      </section>

      <p className="mt-6 text-xs text-muted-foreground">
        Created {formatDateTime(item.createdAt)}
        {item.createdBy ? ` by ${item.createdBy.fullName}` : ""} · Last updated {formatDateTime(item.updatedAt)}
      </p>
    </>
  );
}
