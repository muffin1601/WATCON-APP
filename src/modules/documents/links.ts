/**
 * Client-safe catalogue of linkable record types: label + route. Used by the stock ledger
 * (source documents), related-document panels, attachments and activity timelines so every
 * document relationship is navigable.
 */
export const ENTITY_ROUTES = {
  project: { label: "Project", path: "/projects" },
  party: { label: "Party", path: "/parties" },
  material_requirement: { label: "Material requirement", path: "/material-planning" },
  purchase_requisition: { label: "Purchase requisition", path: "/purchase-requisitions" },
  rfq: { label: "Rate enquiry", path: "/rate-enquiries" },
  supplier_quotation: { label: "Supplier quotation", path: "/supplier-quotations" },
  purchase_order: { label: "Purchase order", path: "/purchase-orders" },
  grn: { label: "Site receipt / GRN", path: "/site-receipts" },
  challan: { label: "Delivery challan", path: "/challans" },
  supplier_bill: { label: "Supplier bill", path: "/supplier-bills" },
  payment: { label: "Payment / receipt", path: "/payments" },
  adjustment_note: { label: "Credit / debit note", path: "/notes" },
  client_po: { label: "Client PO", path: "/client-pos" },
  sales_order: { label: "Sales order", path: "/sales-orders" },
  ra_bill: { label: "Running bill", path: "/running-bills" },
  client_invoice: { label: "Client invoice", path: "/client-invoices" },
  stock_count: { label: "Stock count", path: "/stock/counts" },
  reservation: { label: "Reservation", path: null },
  stock: { label: "Stock entry", path: null },
  manual: { label: "Manual entry", path: null },
} as const satisfies Record<string, { label: string; path: string | null }>;

export type EntityType = keyof typeof ENTITY_ROUTES;

export function isEntityType(v: string): v is EntityType {
  return v in ENTITY_ROUTES;
}

export function entityHref(type: string, id: string): string | null {
  if (!isEntityType(type)) return null;
  const path = ENTITY_ROUTES[type].path;
  return path ? `${path}/${id}` : null;
}

export function entityLabel(type: string): string {
  return isEntityType(type) ? ENTITY_ROUTES[type].label : type.replace(/_/g, " ");
}

export function sourceLink(type: string, id: string): { label: string; href: string | null } {
  return { label: entityLabel(type), href: entityHref(type, id) };
}
