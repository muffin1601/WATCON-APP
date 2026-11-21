"use client";

import { Boxes, Eye, History, MoreHorizontal, PackageSearch, Pencil, Power, PowerOff, Tags } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RecordStatusBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/states";
import { DataTable, type DataTableColumn } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDate, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STOCK_TXN_LABELS, type StockTxnType } from "@/modules/inventory/rules";
import { EditBrandDialog, type BrandDefaults } from "./brand-form";
import { EditItemDialog, type ItemDefaults } from "./item-form";
import { InventoryStatusConfirm } from "./status-confirm";

const num = "text-right tabular-nums whitespace-nowrap";

// ─────────────────────────────── Items ───────────────────────────────

export type ItemRow = ItemDefaults & { brandCount: number; totalStock: string };

function ItemActions({ row, canManage, categories }: { row: ItemRow; canManage: boolean; categories: string[] }) {
  const [editOpen, setEditOpen] = useState(false);
  const active = row.status === "ACTIVE";
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/items/${row.id}`}>
              <Eye /> View stock
            </Link>
          </DropdownMenuItem>
          {canManage && (
            <>
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <InventoryStatusConfirm
                kind="item"
                id={row.id}
                name={row.name}
                status={row.status}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    {active ? <PowerOff /> : <Power />} {active ? "Deactivate" : "Activate"}
                  </DropdownMenuItem>
                }
              />
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {canManage && <EditItemDialog item={row} categories={categories} open={editOpen} onOpenChange={setEditOpen} />}
    </>
  );
}

export function ItemsTable({ rows, canManage, categories }: { rows: ItemRow[]; canManage: boolean; categories: string[] }) {
  const columns: DataTableColumn<ItemRow>[] = [
    { id: "code", header: "Code", sortKey: "code", cell: ({ row }) => <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">{row.original.code}</span> },
    {
      id: "name",
      header: "Item",
      sortKey: "name",
      cell: ({ row }) => (
        <Link href={`/items/${row.original.id}`} className="font-medium hover:text-primary hover:underline">
          {row.original.name}
        </Link>
      ),
    },
    { id: "category", header: "Category", sortKey: "category", cell: ({ row }) => <span className="text-muted-foreground">{row.original.category ?? "—"}</span> },
    { id: "unit", header: "Unit", cell: ({ row }) => row.original.unit },
    { id: "brands", header: "Brands", className: "text-right", cell: ({ row }) => <span className="tabular-nums">{row.original.brandCount}</span> },
    { id: "stock", header: "Total stock", className: num, cell: ({ row }) => `${formatQty(row.original.totalStock)} ${row.original.unit}` },
    { id: "status", header: "Status", cell: ({ row }) => <RecordStatusBadge status={row.original.status} /> },
    { id: "actions", header: () => <span className="sr-only">Actions</span>, className: "w-10", cell: ({ row }) => <ItemActions row={row.original} canManage={canManage} categories={categories} /> },
  ];
  return <DataTable columns={columns} data={rows} getRowId={(r) => r.id} defaultSort="name" empty={<EmptyState icon={Boxes} title="No items found" description={canManage ? "Add an item or adjust your filters." : "Try adjusting your search or filters."} />} />;
}

// ─────────────────────────────── Brands ───────────────────────────────

export type BrandRow = BrandDefaults & { itemCount: number };

function BrandActions({ row }: { row: BrandRow }) {
  const [editOpen, setEditOpen] = useState(false);
  const active = row.status === "ACTIVE";
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/stock?brandId=${row.id}`}>
              <PackageSearch /> View stock
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <InventoryStatusConfirm
            kind="brand"
            id={row.id}
            name={row.name}
            status={row.status}
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                {active ? <PowerOff /> : <Power />} {active ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>
      <EditBrandDialog brand={row} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}

export function BrandsTable({ rows, canManage }: { rows: BrandRow[]; canManage: boolean }) {
  const columns: DataTableColumn<BrandRow>[] = [
    { id: "name", header: "Brand", sortKey: "name", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { id: "code", header: "Code", sortKey: "code", cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.code}</span> },
    { id: "description", header: "Description", cell: ({ row }) => <span className="line-clamp-1 text-muted-foreground">{row.original.description ?? "—"}</span> },
    {
      id: "items",
      header: "Items",
      className: "text-right",
      cell: ({ row }) => (
        <Link href={`/stock?brandId=${row.original.id}`} className="tabular-nums hover:text-primary hover:underline">
          {row.original.itemCount}
        </Link>
      ),
    },
    { id: "status", header: "Status", cell: ({ row }) => <RecordStatusBadge status={row.original.status} /> },
  ];
  if (canManage) columns.push({ id: "actions", header: () => <span className="sr-only">Actions</span>, className: "w-10", cell: ({ row }) => <BrandActions row={row.original} /> });
  return <DataTable columns={columns} data={rows} getRowId={(r) => r.id} defaultSort="name" empty={<EmptyState icon={Tags} title="No brands found" description={canManage ? "Add a brand or adjust your filters." : "Try adjusting your search or filters."} />} />;
}

// ─────────────────────────── Stock summary ───────────────────────────

export type StockRow = {
  id: string;
  item: { id: string; code: string; name: string; unit: string; category: string | null; status: string };
  brand: { id: string; name: string; status: string };
  opening: string;
  inward: string;
  outward: string;
  closing: string;
};

export function StockTable({ rows, showItem = true }: { rows: StockRow[]; showItem?: boolean }) {
  const columns: DataTableColumn<StockRow>[] = [];
  if (showItem) {
    columns.push({
      id: "item",
      header: "Item",
      cell: ({ row }) => (
        <div className="min-w-40">
          <Link href={`/items/${row.original.item.id}`} className="font-medium hover:text-primary hover:underline">
            {row.original.item.name}
          </Link>
          <div className="font-mono text-xs text-muted-foreground">{row.original.item.code}</div>
        </div>
      ),
    });
  }
  columns.push(
    {
      id: "brand",
      header: "Brand",
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {row.original.brand.name}
          {(row.original.brand.status !== "ACTIVE" || row.original.item.status !== "ACTIVE") && <span className="ml-1.5 text-xs text-muted-foreground">(inactive)</span>}
        </span>
      ),
    },
    { id: "unit", header: "Unit", cell: ({ row }) => row.original.item.unit },
    { id: "opening", header: "Opening", className: num, cell: ({ row }) => formatQty(row.original.opening) },
    { id: "inward", header: "Inward", className: cn(num, "text-emerald-700"), cell: ({ row }) => formatQty(row.original.inward) },
    { id: "outward", header: "Outward", className: cn(num, "text-rose-700"), cell: ({ row }) => formatQty(row.original.outward) },
    { id: "closing", header: "Closing", className: cn(num, "font-semibold"), cell: ({ row }) => formatQty(row.original.closing) },
    {
      id: "ledger",
      header: () => <span className="sr-only">Ledger</span>,
      className: "w-10",
      cell: ({ row }) => (
        <Button asChild variant="ghost" size="icon-sm" aria-label={`Ledger for ${row.original.item.name} — ${row.original.brand.name}`}>
          <Link href={`/stock?tab=ledger&itemId=${row.original.item.id}&brandId=${row.original.brand.id}`}>
            <History />
          </Link>
        </Button>
      ),
    },
  );
  return <DataTable columns={columns} data={rows} getRowId={(r) => r.id} empty={<EmptyState icon={PackageSearch} title="No stock positions" description="Link brands to items to start tracking stock." />} />;
}

// ─────────────────────────────── Ledger ───────────────────────────────

export type LedgerRow = {
  id: string;
  code: string;
  type: StockTxnType;
  direction: "IN" | "OUT";
  quantity: string;
  balanceAfter: string;
  txnDate: string;
  reference: string | null;
  remarks: string | null;
  reason: string | null;
  item: { id: string; code: string; name: string; unit: string };
  brand: { id: string; name: string };
  location: { id: string; name: string } | null;
  project: { id: string; code: string } | null;
  source: { label: string; href: string | null } | null;
  createdBy: string;
  /** Manual entry that has not been reversed (reversal is offered to stock.adjust holders). */
  reversible?: boolean;
};

const IN_STYLE = "border-emerald-200 bg-emerald-50 text-emerald-700";
const OUT_STYLE = "border-rose-200 bg-rose-50 text-rose-700";
const TYPE_STYLES: Record<StockTxnType, string> = {
  OPENING: "border-sky-200 bg-sky-50 text-sky-700",
  INWARD: IN_STYLE,
  OUTWARD: OUT_STYLE,
  ADJUSTMENT: "border-amber-200 bg-amber-50 text-amber-800",
  RECEIPT: IN_STYLE,
  TRANSFER_OUT: "border-violet-200 bg-violet-50 text-violet-700",
  TRANSFER_IN: "border-violet-200 bg-violet-50 text-violet-700",
  RETURN_TO_SUPPLIER: OUT_STYLE,
  CLIENT_DELIVERY: OUT_STYLE,
  CONSUMPTION: "border-slate-200 bg-slate-50 text-slate-700",
  WRITE_OFF: "border-amber-200 bg-amber-50 text-amber-800",
  REVERSAL: "border-amber-200 bg-amber-50 text-amber-800",
};

export function LedgerTable({ rows, showItem = true, action }: { rows: LedgerRow[]; showItem?: boolean; action?: (row: LedgerRow) => React.ReactNode }) {
  const columns: DataTableColumn<LedgerRow>[] = [
    { id: "date", header: "Date", cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.txnDate)}</span> },
    { id: "code", header: "Entry", cell: ({ row }) => <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">{row.original.code}</span> },
    {
      id: "type",
      header: "Type",
      cell: ({ row }) => (
        <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap", TYPE_STYLES[row.original.type])}>
          {STOCK_TXN_LABELS[row.original.type]}
          {(row.original.type === "ADJUSTMENT" || row.original.type === "REVERSAL") && (row.original.direction === "IN" ? " +" : " −")}
        </span>
      ),
    },
  ];
  if (showItem) {
    columns.push({
      id: "item",
      header: "Item",
      cell: ({ row }) => (
        <Link href={`/items/${row.original.item.id}`} className="font-medium whitespace-nowrap hover:text-primary hover:underline">
          {row.original.item.name}
        </Link>
      ),
    });
  }
  columns.push(
    { id: "brand", header: "Brand", cell: ({ row }) => <span className="whitespace-nowrap">{row.original.brand.name}</span> },
    { id: "location", header: "Location", cell: ({ row }) => <span className="whitespace-nowrap">{row.original.location?.name ?? "—"}</span> },
    { id: "in", header: "In", className: cn(num, "text-emerald-700"), cell: ({ row }) => (row.original.direction === "IN" ? formatQty(row.original.quantity) : "") },
    { id: "out", header: "Out", className: cn(num, "text-rose-700"), cell: ({ row }) => (row.original.direction === "OUT" ? formatQty(row.original.quantity) : "") },
    { id: "balance", header: "Balance", className: cn(num, "font-medium"), cell: ({ row }) => `${formatQty(row.original.balanceAfter)} ${row.original.item.unit}` },
    {
      id: "reference",
      header: "Source / reference",
      cell: ({ row }) => {
        const s = row.original.source;
        return (
          <span className="flex flex-col whitespace-nowrap">
            {s && (s.href ? <Link href={s.href} className="text-primary hover:underline">{s.label}</Link> : <span>{s.label}</span>)}
            {row.original.reference && <span className="text-xs text-muted-foreground">{row.original.reference}</span>}
            {!s && !row.original.reference && <span className="text-muted-foreground">—</span>}
          </span>
        );
      },
    },
    {
      id: "notes",
      header: "Reason / remarks",
      cell: ({ row }) => <span className="line-clamp-2 min-w-40 text-muted-foreground">{[row.original.reason, row.original.remarks].filter(Boolean).join(" · ") || "—"}</span>,
    },
    { id: "by", header: "By", cell: ({ row }) => <span className="whitespace-nowrap">{row.original.createdBy}</span> },
  );
  if (action) columns.push({ id: "action", header: "", cell: ({ row }) => action(row.original) });
  return <DataTable columns={columns} data={rows} getRowId={(r) => r.id} empty={<EmptyState icon={History} title="No stock movements" description="Movements appear here once stock is posted." />} />;
}
