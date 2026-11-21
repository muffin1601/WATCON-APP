import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GrnForm } from "@/components/stores/grn-form";
import { docCrumbs } from "@/components/procurement/crumbs";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { orNotFound } from "@/lib/pages";
import { todayString } from "@/modules/inventory/serialize";
import { receiptSource } from "@/modules/stores/grn";

export const metadata: Metadata = { title: "Receive material" };

export default async function NewReceiptPage({ searchParams }: PageProps<"/site-receipts/new">) {
  const user = await requirePagePermission("grn.create");
  const sp = await searchParams;
  const poId = typeof sp.poId === "string" ? sp.poId : null;
  const challanId = typeof sp.challanId === "string" ? sp.challanId : null;
  if (!poId && !challanId) redirect("/site-receipts");
  if (!/^[0-9a-f-]{36}$/i.test((poId ?? challanId)!)) notFound();
  const source = await orNotFound(receiptSource(user, poId ? "po" : "challan", (poId ?? challanId)!));
  return (
    <>
      <PageHeader title="Receive material" description="Check each item against the vehicle and the supplier's challan, then submit. A second person verifies and posts it to stock." breadcrumbs={docCrumbs(source.project, "site-receipts", { label: `Receive ${source.number}` })} />
      <GrnForm source={source} header={{ receiptDate: todayString(), supplierChallanNo: "", supplierInvoiceNo: "", vehicleNo: "", receivedByName: user.fullName, remarks: "", latitude: "", longitude: "" }} />
    </>
  );
}
