import { projectCrumbs } from "@/components/projects/project-breadcrumbs";
import type { Crumb } from "@/components/shared/page-header";

const TABS = {
  requisitions: { label: "Requisitions", list: "/purchase-requisitions", key: "requisitions" },
  "rate-enquiries": { label: "Rate enquiries", list: "/rate-enquiries", key: "rate-enquiries" },
  "purchase-orders": { label: "Purchase orders", list: "/purchase-orders", key: "purchase-orders" },
  "site-receipts": { label: "Site receipts", list: "/site-receipts", key: "site-receipts" },
  challans: { label: "Challans", list: "/challans", key: "challans" },
  "material-planning": { label: "Material planning", list: "/material-planning", key: "planning" },
  stock: { label: "Stock", list: "/stock", key: "stock" },
} as const;

export type ProjectTab = keyof typeof TABS;

/** Projects › {code} › {tab} › …tail (via projectCrumbs) — every document is reachable from inside its project. Falls back to the module list. */
export function docCrumbs(project: { id: string; code: string } | null | undefined, tab: ProjectTab, ...tail: Crumb[]): Crumb[] {
  const t = TABS[tab];
  return [...projectCrumbs(project, t.key, { label: t.label, href: t.list }), ...tail];
}

/** The project a list page is locked to via `?projectId=` (null if absent or not one the user can see). */
export function lockedProject<P extends { id: string }>(projects: P[], sp: Record<string, string | string[] | undefined>): P | null {
  const id = typeof sp.projectId === "string" ? sp.projectId : null;
  return (id && projects.find((p) => p.id === id)) || null;
}

/** Breadcrumbs for a module list page: Dashboard › Tab, or Projects › {code} › Tab when locked to a project. */
export function listCrumbs(locked: { id: string; code: string } | null, tab: ProjectTab): Crumb[] {
  const t = TABS[tab];
  if (!locked) return [{ label: "Dashboard", href: "/dashboard" }, { label: t.label }];
  const c = docCrumbs(locked, tab);
  const last = c[c.length - 1]!;
  return [...c.slice(0, -1), { label: last.label }];
}
