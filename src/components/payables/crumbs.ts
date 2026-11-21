import type { Crumb } from "@/components/shared/page-header";
import { projectCrumbs, type ProjectTab } from "@/components/projects/project-breadcrumbs";

const TABS = { "supplier-bills": "Supplier bills", payments: "Payments", receipts: "Receipts", notes: "Credit / debit notes" } as const;
export type PayablesTab = keyof typeof TABS;
const LISTS: Record<PayablesTab, string> = { "supplier-bills": "/supplier-bills", payments: "/payments", receipts: "/payments?direction=IN", notes: "/notes" };
const HUB_TAB: Record<PayablesTab, ProjectTab> = { "supplier-bills": "supplier-bills", payments: "payments", receipts: "client-receipts", notes: "notes" };

/** Projects › {code} › {tab} › {doc}; falls back to the module list when there is no project. */
export function payablesCrumbs(project: { id: string; code: string } | null | undefined, tab: PayablesTab, doc?: string): Crumb[] {
  if (!project) return doc ? [{ label: TABS[tab], href: LISTS[tab] }, { label: doc }] : [{ label: "Dashboard", href: "/dashboard" }, { label: TABS[tab] }];
  const crumbs = projectCrumbs(project, HUB_TAB[tab]);
  if (doc) return [...crumbs, { label: doc }];
  const last = crumbs[crumbs.length - 1];
  return [...crumbs.slice(0, -1), { label: last.label }];
}
