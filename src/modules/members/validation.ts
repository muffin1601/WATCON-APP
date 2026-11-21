import { z } from "zod";
import { passwordPolicy } from "@/lib/auth/password-policy";
import { optionalDate, optionalText, phone, text, uuid } from "@/lib/validations/common";
import { ROLE_KEYS } from "@/lib/permissions/definitions";

/** Roles that can be chosen in the member form (Super Admin only via the bootstrap procedure). */
export const ASSIGNABLE_ROLES = ["USER", "ADMIN", "PROJECT_MANAGER", "SITE_ENGINEER", "PURCHASE", "STOREKEEPER", "ACCOUNTS", "VIEWER"] as const;

const base = {
  fullName: text("Full name", 120, 2),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(160),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,40}$/, "3–40 characters: letters, numbers, dot, underscore or hyphen."),
  phone,
  whatsappNumber: phone,
  designation: optionalText("Designation", 120),
  joiningDate: optionalDate,
  role: z.enum(ASSIGNABLE_ROLES),
  primaryDepartmentId: z.union([uuid, z.literal(""), z.null()]).optional().transform((v) => (v ? v : null)),
  additionalDepartmentIds: z.array(uuid).max(50).default([]),
};

export const memberCreateSchema = z.object({ ...base, password: passwordPolicy });
/** Updates accept SUPER_ADMIN only so a Super Admin's own role can be kept unchanged; promotion is blocked in the service. */
export const memberUpdateSchema = z.object({ ...base, role: z.enum(ROLE_KEYS) });
export const memberPasswordResetSchema = z.object({ password: passwordPolicy });

export type MemberCreateInput = z.input<typeof memberCreateSchema>;
export type MemberUpdateInput = z.input<typeof memberUpdateSchema>;
export type MemberPasswordResetInput = z.input<typeof memberPasswordResetSchema>;

export const memberListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  departmentId: uuid.optional().catch(undefined),
  role: z.enum(ROLE_KEYS).optional().catch(undefined),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional().catch(undefined),
  sort: z.enum(["fullName", "employeeCode", "createdAt", "joiningDate"]).catch("fullName").default("fullName"),
  dir: z.enum(["asc", "desc"]).catch("asc").default("asc"),
  page: z.coerce.number().int().min(1).catch(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).catch(20).default(20),
});
