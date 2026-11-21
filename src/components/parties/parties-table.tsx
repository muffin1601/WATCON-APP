"use client";

import { Users } from "lucide-react";
import Link from "next/link";
import { DocStatusBadge, ToneBadge } from "@/components/commercial/ui";
import { EmptyState } from "@/components/shared/states";
import { DataTable, type DataTableColumn } from "@/components/tables/data-table";
import { stateName } from "@/lib/gst";

export type PartyRow = { id: string; code: string; name: string; isClient: boolean; isSupplier: boolean; gstin: string | null; stateCode: string | null; city: string | null; phone: string | null; contactPerson: string | null; paymentTermsDays: number | null; status: string };

export function PartiesTable({ rows }: { rows: PartyRow[] }) {
  const columns: DataTableColumn<PartyRow>[] = [
    { id: "code", header: "Code", sortKey: "code", cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.code}</span> },
    {
      id: "name",
      header: "Name",
      sortKey: "name",
      cell: ({ row }) => (
        <Link href={`/parties/${row.original.id}`} className="font-medium hover:text-primary hover:underline">
          {row.original.name}
        </Link>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: ({ row }) => (
        <span className="flex gap-1">
          {row.original.isClient && <ToneBadge tone="info">Client</ToneBadge>}
          {row.original.isSupplier && <ToneBadge tone="violet">Supplier</ToneBadge>}
        </span>
      ),
    },
    { id: "gstin", header: "GSTIN", cell: ({ row }) => <span className="font-mono text-xs">{row.original.gstin ?? <span className="text-muted-foreground">Unregistered</span>}</span> },
    { id: "state", header: "State", cell: ({ row }) => <span className="whitespace-nowrap">{stateName(row.original.stateCode)}</span> },
    { id: "contact", header: "Contact", cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{[row.original.contactPerson, row.original.phone].filter(Boolean).join(" · ") || "—"}</span> },
    { id: "terms", header: "Terms", cell: ({ row }) => (row.original.paymentTermsDays !== null ? `${row.original.paymentTermsDays} days` : "—") },
    { id: "status", header: "Status", cell: ({ row }) => <DocStatusBadge status={row.original.status} /> },
  ];
  return <DataTable columns={columns} data={rows} getRowId={(r) => r.id} defaultSort="name" empty={<EmptyState icon={Users} title="No clients or suppliers yet" description="Add the parties you buy from and bill to." />} />;
}
