import { z } from "zod";
import { GSTIN_RE, GST_STATES, IFSC_RE, PAN_RE, gstinChecksumValid } from "@/lib/gst";
import { optionalText, phone, text } from "@/lib/validations/common";

const upperOpt = (label: string, max: number) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .max(max, `${label} must be at most ${max} characters.`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

/** Optional non-negative money with ≤ 2 decimals, as a string. */
export const optionalMoney = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((v) => (v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim()))
  .pipe(z.union([z.null(), z.string().regex(/^\d{1,14}(\.\d{1,2})?$/, "Enter an amount with up to 2 decimals.")]));

/** Optional percentage 0–100 with ≤ 2 decimals. */
export const optionalPct = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((v) => (v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim()))
  .pipe(z.union([z.null(), z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a percentage.").refine((v) => Number(v) <= 100, "Must be 100 or less.")]));

export const partyInputSchema = z
  .object({
    name: text("Name", 160, 2),
    legalName: optionalText("Legal name", 200),
    isClient: z.boolean().default(false),
    isSupplier: z.boolean().default(false),
    gstin: upperOpt("GSTIN", 15),
    pan: upperOpt("PAN", 10),
    stateCode: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || v in GST_STATES, "Choose a valid state."),
    address: optionalText("Address", 500),
    city: optionalText("City", 80),
    pincode: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || /^[1-9]\d{5}$/.test(v), "Enter a 6-digit PIN code."),
    contactPerson: optionalText("Contact person", 120),
    phone,
    email: z.string().trim().toLowerCase().email("Enter a valid email.").max(160).optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
    whatsappNumber: phone,
    paymentTermsDays: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .transform((v) => (v === undefined || v === null || String(v).trim() === "" ? null : Number(v)))
      .pipe(z.union([z.null(), z.number().int("Whole days only.").min(0).max(365, "At most 365 days.")])),
    creditLimit: optionalMoney,
    tdsSection: upperOpt("TDS section", 10),
    tdsRate: optionalPct,
    bankName: optionalText("Bank name", 120),
    bankAccount: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v ? v.replace(/\s+/g, "") : null))
      .refine((v) => v === null || /^\d{6,20}$/.test(v), "Account number must be 6–20 digits."),
    ifsc: upperOpt("IFSC", 11),
    notes: optionalText("Notes", 2000),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  })
  .superRefine((v, ctx) => {
    if (!v.isClient && !v.isSupplier) ctx.addIssue({ code: "custom", path: ["isClient"], message: "Mark the party as a client, a supplier, or both." });
    if (v.gstin) {
      if (!GSTIN_RE.test(v.gstin)) ctx.addIssue({ code: "custom", path: ["gstin"], message: "GSTIN format is 15 characters, e.g. 27AAPFU0939F1ZV." });
      else if (!gstinChecksumValid(v.gstin)) ctx.addIssue({ code: "custom", path: ["gstin"], message: "GSTIN check digit is invalid — please re-check it." });
      else {
        if (v.stateCode && v.stateCode !== v.gstin.slice(0, 2)) ctx.addIssue({ code: "custom", path: ["stateCode"], message: `GSTIN belongs to state code ${v.gstin.slice(0, 2)}.` });
        if (v.pan && v.pan !== v.gstin.slice(2, 12)) ctx.addIssue({ code: "custom", path: ["pan"], message: "PAN does not match the GSTIN." });
      }
    }
    if (v.pan && !PAN_RE.test(v.pan)) ctx.addIssue({ code: "custom", path: ["pan"], message: "PAN format is AAAAA9999A." });
    if (v.ifsc && !IFSC_RE.test(v.ifsc)) ctx.addIssue({ code: "custom", path: ["ifsc"], message: "IFSC format is AAAA0XXXXXX." });
    if ((v.tdsRate === null) !== (v.tdsSection === null)) ctx.addIssue({ code: "custom", path: ["tdsRate"], message: "Enter both the TDS section and rate, or neither." });
  })
  .transform((v) => ({
    ...v,
    // Derived from the GSTIN when not entered.
    stateCode: v.stateCode ?? (v.gstin && GSTIN_RE.test(v.gstin) ? v.gstin.slice(0, 2) : null),
    pan: v.pan ?? (v.gstin && GSTIN_RE.test(v.gstin) ? v.gstin.slice(2, 12) : null),
  }));

export type PartyInput = z.input<typeof partyInputSchema>;

export const partyListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  type: z.enum(["client", "supplier"]).optional().catch(undefined),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional().catch(undefined),
  sort: z.enum(["name", "code", "createdAt"]).catch("name").default("name"),
  dir: z.enum(["asc", "desc"]).catch("asc").default("asc"),
  page: z.coerce.number().int().min(1).catch(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).catch(20).default(20),
});
