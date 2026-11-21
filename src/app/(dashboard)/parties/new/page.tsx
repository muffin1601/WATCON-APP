import type { Metadata } from "next";
import { PartyForm } from "@/components/parties/party-form";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Add party" };

export default async function NewPartyPage({ searchParams }: PageProps<"/parties/new">) {
  await requirePagePermission("parties.manage");
  const sp = await searchParams;
  const type = sp.type === "client" || sp.type === "supplier" ? sp.type : null;
  const returnTo = typeof sp.returnTo === "string" && sp.returnTo.startsWith("/") && !sp.returnTo.startsWith("//") ? sp.returnTo : undefined;
  return (
    <>
      <PageHeader title={`Add ${type ?? "client or supplier"}`} breadcrumbs={[{ label: "Clients & suppliers", href: "/parties" }, { label: "New" }]} />
      <PartyForm defaults={{ isClient: type === "client", isSupplier: type === "supplier" }} returnTo={returnTo} />
    </>
  );
}
