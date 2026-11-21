"use client";

import { ClipboardList, MessageSquareQuote, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { DocStatusBadge, Money } from "@/components/commercial/ui";
import { EmptyState } from "@/components/shared/states";
import { DataTable, type DataTableColumn } from "@/components/tables/data-table";
import { formatDate } from "@/lib/format";

export type PoRow = { id: string; number: string; revision: number; status: string; orderDate: string; expectedDate: string | null; total: string; party: { id: string; name: string }; project: { id: string; code: string } | null; overdue: boolean };

export function PoTable({ rows }: { rows: PoRow[] }) {
  const columns: DataTableColumn<PoRow>[] = [
    { id: "number", header: "PO", cell: ({ row }) => <Link href={`/purchase-orders/${row.original.id}`} className="font-medium hover:text-primary hover:underline">{row.original.number}{row.original.revision ? <span className="ml-1 text-xs text-muted-foreground">rev {row.original.revision}</span> : null}</Link> },
    { id: "date", header: "Date", cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.orderDate)}</span> },
    { id: "supplier", header: "Supplier", cell: ({ row }) => row.original.party.name },
    { id: "project", header: "Project", cell: ({ row }) => (row.original.project ? <Link className="font-mono text-xs hover:underline" href={`/projects/${row.original.project.id}`}>{row.original.project.code}</Link> : <span className="text-xs text-muted-foreground">—</span>) },
    { id: "expected", header: "Expected", cell: ({ row }) => <span className={row.original.overdue ? "font-medium text-rose-700" : ""}>{formatDate(row.original.expectedDate)}</span> },
    { id: "total", header: "Value", className: "text-right", cell: ({ row }) => <Money value={row.original.total} /> },
    { id: "status", header: "Status", cell: ({ row }) => <DocStatusBadge status={row.original.status} /> },
  ];
  return <DataTable columns={columns} data={rows} getRowId={(r) => r.id} empty={<EmptyState icon={ShoppingCart} title="No purchase orders" description="Create one from an approved requisition, an RFQ award, material planning, or manually." />} />;
}

export type PrRow = { id: string; number: string; status: string; createdAt: string; requiredBy: string | null; purpose: string | null; project: { id: string; code: string } | null; createdBy: string; lines: number };

export function PrTable({ rows }: { rows: PrRow[] }) {
  const columns: DataTableColumn<PrRow>[] = [
    { id: "number", header: "Requisition", cell: ({ row }) => <Link href={`/purchase-requisitions/${row.original.id}`} className="font-medium hover:text-primary hover:underline">{row.original.number}</Link> },
    { id: "date", header: "Raised", cell: ({ row }) => formatDate(row.original.createdAt) },
    { id: "project", header: "Project", cell: ({ row }) => row.original.project?.code ?? <span className="text-xs text-muted-foreground">—</span> },
    { id: "purpose", header: "Purpose", cell: ({ row }) => <span className="line-clamp-1 max-w-72 text-muted-foreground">{row.original.purpose ?? "—"}</span> },
    { id: "lines", header: "Lines", className: "text-right", cell: ({ row }) => row.original.lines },
    { id: "by", header: "Required by", cell: ({ row }) => formatDate(row.original.requiredBy) },
    { id: "who", header: "Raised by", cell: ({ row }) => row.original.createdBy },
    { id: "status", header: "Status", cell: ({ row }) => <DocStatusBadge status={row.original.status} /> },
  ];
  return <DataTable columns={columns} data={rows} getRowId={(r) => r.id} empty={<EmptyState icon={ClipboardList} title="No purchase requisitions" description="Raise one from material planning shortages or manually." />} />;
}

export type RfqRow = { id: string; number: string; title: string; status: string; createdAt: string; responseDue: string | null; project: { id: string; code: string } | null; lines: number; suppliers: number; quotations: number };

export function RfqTable({ rows }: { rows: RfqRow[] }) {
  const columns: DataTableColumn<RfqRow>[] = [
    { id: "number", header: "RFQ", cell: ({ row }) => <Link href={`/rate-enquiries/${row.original.id}`} className="font-medium hover:text-primary hover:underline">{row.original.number}</Link> },
    { id: "title", header: "Subject", cell: ({ row }) => <span className="line-clamp-1 max-w-80">{row.original.title}</span> },
    { id: "project", header: "Project", cell: ({ row }) => row.original.project?.code ?? <span className="text-xs text-muted-foreground">—</span> },
    { id: "created", header: "Created", cell: ({ row }) => formatDate(row.original.createdAt) },
    { id: "due", header: "Quotes due", cell: ({ row }) => formatDate(row.original.responseDue) },
    { id: "resp", header: "Responses", className: "text-right", cell: ({ row }) => `${row.original.quotations} / ${row.original.suppliers}` },
    { id: "status", header: "Status", cell: ({ row }) => <DocStatusBadge status={row.original.status} /> },
  ];
  return <DataTable columns={columns} data={rows} getRowId={(r) => r.id} empty={<EmptyState icon={MessageSquareQuote} title="No rate enquiries" description="Request supplier rates from an approved requisition or directly." />} />;
}
