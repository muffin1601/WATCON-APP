import { redirect } from "next/navigation";

/** Client receipts are recorded in Payments & receipts (direction IN). */
export default async function ReceiptsPage({ searchParams }: PageProps<"/receipts">) {
  const sp = await searchParams;
  const projectId = typeof sp.projectId === "string" ? `&projectId=${encodeURIComponent(sp.projectId)}` : "";
  redirect(`/payments?direction=IN${projectId}`);
}
