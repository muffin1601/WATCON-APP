import type { Crumb } from "@/components/shared/page-header";

/**
 * Project workspace tabs (`/projects/[id]?tab=…`). Client-safe, so any module page can link back
 * to the right tab of its project.
 */
export const PROJECT_TABS = {
  overview: "Overview",
  "sales-orders": "Sales orders",
  "client-pos": "Client POs",
  "running-bills": "Running bills",
  invoices: "Invoices",
  "client-receipts": "Receipts",
  planning: "Material planning",
  requisitions: "Requisitions",
  "rate-enquiries": "Rate enquiries",
  "purchase-orders": "Purchase orders",
  "site-receipts": "Site receipts",
  challans: "Challans",
  stock: "Site stock",
  accounts: "Accounts",
  "supplier-bills": "Supplier bills",
  payments: "Payments",
  notes: "Credit / debit notes",
  tasks: "Tasks",
  documents: "Documents",
  activity: "Activity",
  history: "Status history",
  team: "Team",
} as const;

export type ProjectTab = keyof typeof PROJECT_TABS;

/** Entity type (as used by attachments / audit / ENTITY_ROUTES) → project tab that lists it. */
export const ENTITY_PROJECT_TAB: Record<string, ProjectTab> = {
  sales_order: "sales-orders",
  client_po: "client-pos",
  ra_bill: "running-bills",
  client_invoice: "invoices",
  receipt: "client-receipts",
  material_requirement: "planning",
  purchase_requisition: "requisitions",
  rfq: "rate-enquiries",
  supplier_quotation: "rate-enquiries",
  purchase_order: "purchase-orders",
  grn: "site-receipts",
  challan: "challans",
  supplier_bill: "supplier-bills",
  payment: "payments",
  adjustment_note: "notes",
};

export function projectTabHref(projectId: string, tab: ProjectTab | string): string {
  return tab === "overview" ? `/projects/${projectId}` : `/projects/${projectId}?tab=${tab}`;
}

/**
 * Breadcrumbs for a document that belongs to a project: Projects › {code} › {Tab}. Append the
 * document's own crumb, e.g. `[...projectCrumbs(po.project, "purchase-orders"), { label: po.number }]`.
 * `tab` may be a tab key or an entity type (e.g. "purchase_order"). With no project, falls back to
 * the module list given in `fallback`.
 */
export function projectCrumbs(project: { id: string; code: string } | null | undefined, tab: ProjectTab | string, fallback?: Crumb): Crumb[] {
  if (!project) return fallback ? [fallback] : [{ label: "Projects", href: "/projects" }];
  const key = (tab in PROJECT_TABS ? tab : ENTITY_PROJECT_TAB[tab] ?? "overview") as ProjectTab;
  const crumbs: Crumb[] = [
    { label: "Projects", href: "/projects" },
    { label: project.code, href: `/projects/${project.id}` },
  ];
  if (key !== "overview") crumbs.push({ label: PROJECT_TABS[key], href: projectTabHref(project.id, key) });
  return crumbs;
}
