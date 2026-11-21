import { FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DocStatusBadge } from "@/components/commercial/ui";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { FilterBar, FilterSelect, SearchInput } from "@/components/tables/filters";
import { Pagination } from "@/components/tables/pagination";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { CATEGORY_LABELS, type AttachmentCategory } from "@/modules/documents/categories";
import { ENTITY_ROUTES, entityHref, entityLabel } from "@/modules/documents/links";
import { listOrgDocuments } from "@/modules/insights/documents";
import { listProjectOptions } from "@/modules/projects/service";

export const metadata: Metadata = { title: "Documents" };

const size = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default async function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  const user = await requireUser();
  const sp = await searchParams;
  const [result, projects] = await Promise.all([listOrgDocuments(user, sp), listProjectOptions(user)]);
  return (
    <>
      <PageHeader title="Documents" description="Every file attached across your projects — purchase orders, challans, photos, invoices, certifications — with who uploaded and verified it." breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Documents" }]} />
      <FilterBar params={["q", "projectId", "category", "entityType", "verification"]}>
        <SearchInput placeholder="Search file name or note…" />
        <FilterSelect param="projectId" label="Project" options={projects.map((p) => ({ value: p.id, label: `${p.code} – ${p.name}` }))} />
        <FilterSelect param="category" label="Category" options={Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))} />
        <FilterSelect param="entityType" label="Attached to" options={Object.entries(ENTITY_ROUTES).filter(([, v]) => v.path).map(([value, v]) => ({ value, label: v.label }))} />
        <FilterSelect param="verification" label="Verification" options={[{ value: "PENDING", label: "Not verified" }, { value: "VERIFIED", label: "Verified" }, { value: "REJECTED", label: "Rejected" }]} />
      </FilterBar>
      {result.rows.length === 0 ? (
        <EmptyState icon={FileText} title="No documents found" description="Files attached to any project record appear here. Open a document (for example a purchase order or site receipt) to attach files." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">File</th>
                <th className="px-3 py-2 text-left font-medium">Category</th>
                <th className="px-3 py-2 text-left font-medium">Attached to</th>
                <th className="px-3 py-2 text-left font-medium">Project</th>
                <th className="px-3 py-2 text-left font-medium">Uploaded</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {result.rows.map((d) => {
                const href = entityHref(d.entityType, d.entityId);
                return (
                  <tr key={d.id}>
                    <td className="max-w-xs px-3 py-2">
                      <a href={`/api/attachments/${d.id}`} target="_blank" rel="noopener" className="block truncate font-medium hover:text-primary hover:underline">
                        {d.fileName}
                      </a>
                      <span className="text-xs text-muted-foreground">
                        {size(d.sizeBytes)}
                        {d.version > 1 ? ` · version ${d.version}` : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{CATEGORY_LABELS[d.category as AttachmentCategory] ?? d.category}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {href ? (
                        <Link href={href} className="text-primary hover:underline">
                          {entityLabel(d.entityType)}
                        </Link>
                      ) : (
                        entityLabel(d.entityType)
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {d.project ? (
                        <Link href={`/projects/${d.project.id}?tab=documents`} className="font-mono text-xs hover:underline">
                          {d.project.code}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">Company</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {d.uploadedBy}
                      <div className="text-xs text-muted-foreground">{formatDate(d.createdAt)}</div>
                    </td>
                    <td className="px-3 py-2">
                      <DocStatusBadge status={d.verificationStatus === "PENDING" ? "OPEN" : d.verificationStatus} label={d.verificationStatus === "PENDING" ? "Not verified" : undefined} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination total={result.total} page={result.page} pageSize={result.pageSize} />
    </>
  );
}
