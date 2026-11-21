/** Client-safe evidence categories. */
export const ATTACHMENT_CATEGORIES = [
  "CLIENT_PO",
  "SIGNED_DOCUMENT",
  "QUOTATION",
  "PURCHASE_ORDER",
  "SUPPLIER_INVOICE",
  "DELIVERY_CHALLAN",
  "SIGNED_CHALLAN",
  "MATERIAL_PHOTO",
  "DAMAGE_PHOTO",
  "WORK_PHOTO",
  "MEASUREMENT_SHEET",
  "CERTIFICATION",
  "PAYMENT_PROOF",
  "SIGNATURE",
  "CORRESPONDENCE",
  "OTHER",
] as const;

export type AttachmentCategory = (typeof ATTACHMENT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<AttachmentCategory, string> = {
  CLIENT_PO: "Client PO",
  SIGNED_DOCUMENT: "Signed document",
  QUOTATION: "Quotation",
  PURCHASE_ORDER: "Purchase order",
  SUPPLIER_INVOICE: "Supplier invoice",
  DELIVERY_CHALLAN: "Delivery challan",
  SIGNED_CHALLAN: "Signed challan / POD",
  MATERIAL_PHOTO: "Material photo",
  DAMAGE_PHOTO: "Damage photo",
  WORK_PHOTO: "Work completion photo",
  MEASUREMENT_SHEET: "Measurement sheet",
  CERTIFICATION: "Certification",
  PAYMENT_PROOF: "Payment proof",
  SIGNATURE: "Receiver signature",
  CORRESPONDENCE: "Correspondence",
  OTHER: "Other",
};
