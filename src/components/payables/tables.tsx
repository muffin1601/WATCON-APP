"use client";

import { FileMinus, ReceiptIndianRupee, Wallet } from "lucide-react";
import Link from "next/link";
import { DocStatusBadge, Money, ToneBadge } from "@/components/commercial/ui";
import { EmptyState } from "@/components/shared/states";
import { DataTable, type DataTableColumn } from "@/components/tables/data-table";
import { formatDate } from "@/lib/format";

const projectCell = (p: { id: string; code: string } | null) => (p ? <Link className="font-mono text-xs hover:underline" href={`/projects/${p.id}`}>{p.code}</Link> : <span className="text-xs text-muted-foreground">—</span>);

export type BillRow = { id: string; number: string; supplierInvoiceNo: string; invoiceDate: string; dueDate: string | null; status: string; matchStatus: string; total: string; outstanding: string; overdue: boolean; party: { id: string; name: string }; project: { id: string; code: string } | null; po: { id: string; number: string } | null };

export function BillTable({ rows, hideProject }: { rows: BillRow[]; hideProject?: boolean }) {
  const columns: DataTableColumn<BillRow>[] = [
    {
      id: "number",
      header: "Bill",
      cell: ({ row }) => (
        <Link href={`/supplier-bills/${row.original.id}`} className="hover:text-primary hover:underline">
          <span className="font-medium">{row.original.number}</span>
          <span className="block text-xs text-muted-foreground">Invoice {row.original.supplierInvoiceNo}</span>
        </Link>
      ),
    },
    { id: "date", header: "Invoice date", cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.invoiceDate)}</span> },
    { id: "supplier", header: "Supplier", cell: ({ row }) => row.original.party.name },
    ...(hideProject ? [] : [{ id: "project", header: "Project", cell: ({ row }: { row: { original: BillRow } }) => projectCell(row.original.project) }]),
    { id: "po", header: "PO", cell: ({ row }) => (row.original.po ? <Link className="text-xs hover:underline" href={`/purchase-orders/${row.original.po.id}`}>{row.original.po.number}</Link> : <span className="text-xs text-muted-foreground">No PO</span>) },
    { id: "due", header: "Due", cell: ({ row }) => <span className={row.original.overdue ? "font-medium whitespace-nowrap text-rose-700" : "whitespace-nowrap"}>{formatDate(row.original.dueDate)}{row.original.overdue ? " · overdue" : ""}</span> },
    { id: "total", header: "Amount", className: "text-right", cell: ({ row }) => <Money value={row.original.total} /> },
    { id: "outstanding", header: "To pay", className: "text-right", cell: ({ row }) => (row.original.outstanding !== "0.00" ? <Money value={row.original.outstanding} /> : <span className="text-muted-foreground">—</span>) },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <span className="flex flex-wrap gap-1">
          <DocStatusBadge status={row.original.status} />
          {row.original.matchStatus === "EXCEPTION" && <DocStatusBadge status="EXCEPTION" />}
        </span>
      ),
    },
  ];
  return <DataTable columns={columns} data={rows} getRowId={(r) => r.id} empty={<EmptyState icon={ReceiptIndianRupee} title="No supplier bills" description="Enter a supplier's invoice against a purchase order, or for services without a PO." />} />;
}

export type PaymentRow = { id: string; number: string; direction: string; paymentDate: string; mode: string; reference: string | null; gross: string; allocated: string; unallocated: string; status: string; party: { id: string; name: string }; project: { id: string; code: string } | null };

const MODE: Record<string, string> = { BANK_TRANSFER: "Bank", CHEQUE: "Cheque", UPI: "UPI", CASH: "Cash", CARD: "Card", OTHER: "Other" };

export function PaymentTable({ rows, direction, hideProject }: { rows: PaymentRow[]; direction: "OUT" | "IN"; hideProject?: boolean }) {
  const columns: DataTableColumn<PaymentRow>[] = [
    { id: "number", header: direction === "OUT" ? "Payment" : "Receipt", cell: ({ row }) => <Link href={`/payments/${row.original.id}`} className="font-medium hover:text-primary hover:underline">{row.original.number}</Link> },
    { id: "date", header: "Date", cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.paymentDate)}</span> },
    { id: "party", header: direction === "OUT" ? "Paid to" : "Received from", cell: ({ row }) => row.original.party.name },
    ...(hideProject ? [] : [{ id: "project", header: "Project", cell: ({ row }: { row: { original: PaymentRow } }) => projectCell(row.original.project) }]),
    { id: "mode", header: "Mode / ref", cell: ({ row }) => <span className="text-xs">{MODE[row.original.mode] ?? row.original.mode}{row.original.reference ? ` · ${row.original.reference}` : ""}</span> },
    { id: "amount", header: "Amount", className: "text-right", cell: ({ row }) => <Money value={row.original.gross} /> },
    { id: "advance", header: "Not yet allocated", className: "text-right", cell: ({ row }) => (row.original.unallocated !== "0.00" ? <ToneBadge tone="warn">Advance <Money value={row.original.unallocated} /></ToneBadge> : <span className="text-muted-foreground">—</span>) },
    { id: "status", header: "Status", cell: ({ row }) => <DocStatusBadge status={row.original.status} /> },
  ];
  return <DataTable columns={columns} data={rows} getRowId={(r) => r.id} empty={<EmptyState icon={Wallet} title={direction === "OUT" ? "No supplier payments yet" : "No client receipts yet"} description={direction === "OUT" ? "Record a payment against approved bills, or an advance." : "Record money received from a client against issued invoices."} />} />;
}

export type NoteRow = { id: string; number: string; noteType: string; partyRole: string; noteDate: string; reason: string; total: string; status: string; party: { id: string; name: string }; project: { id: string; code: string } | null; against: { href: string; number: string } | null };

export function NoteTable({ rows, hideProject }: { rows: NoteRow[]; hideProject?: boolean }) {
  const columns: DataTableColumn<NoteRow>[] = [
    { id: "number", header: "Note", cell: ({ row }) => <Link href={`/notes/${row.original.id}`} className="font-medium hover:text-primary hover:underline">{row.original.number}</Link> },
    { id: "type", header: "Type", cell: ({ row }) => <span className="text-xs">{row.original.noteType === "CREDIT" ? "Credit" : "Debit"} note · {row.original.partyRole === "SUPPLIER" ? "supplier" : "client"}</span> },
    { id: "date", header: "Date", cell: ({ row }) => formatDate(row.original.noteDate) },
    { id: "party", header: "Party", cell: ({ row }) => row.original.party.name },
    ...(hideProject ? [] : [{ id: "project", header: "Project", cell: ({ row }: { row: { original: NoteRow } }) => projectCell(row.original.project) }]),
    { id: "against", header: "Against", cell: ({ row }) => (row.original.against ? <Link className="text-xs hover:underline" href={row.original.against.href}>{row.original.against.number}</Link> : "—") },
    { id: "reason", header: "Reason", cell: ({ row }) => <span className="line-clamp-1 max-w-64 text-muted-foreground">{row.original.reason}</span> },
    { id: "total", header: "Amount", className: "text-right", cell: ({ row }) => <Money value={row.original.total} /> },
    { id: "status", header: "Status", cell: ({ row }) => <DocStatusBadge status={row.original.status} /> },
  ];
  return <DataTable columns={columns} data={rows} getRowId={(r) => r.id} empty={<EmptyState icon={FileMinus} title="No credit or debit notes" description="Use a note to reduce what is owed on a bill or invoice — rate differences, short supply, returns." />} />;
}
