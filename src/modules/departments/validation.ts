import { z } from "zod";
import { optionalText, text, uuid } from "@/lib/validations/common";

export const departmentInputSchema = z.object({
  name: text("Department name", 80, 2),
  description: optionalText("Description", 1000),
  headId: z.union([uuid, z.literal(""), z.null()]).optional().transform((v) => (v ? v : null)),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});
export type DepartmentInput = z.input<typeof departmentInputSchema>;

export const departmentListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional().catch(undefined),
  sort: z.enum(["name", "code", "createdAt"]).catch("name").default("name"),
  dir: z.enum(["asc", "desc"]).catch("asc").default("asc"),
  page: z.coerce.number().int().min(1).catch(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).catch(20).default(20),
});

export const membershipSchema = z.object({ departmentId: uuid, userId: uuid });
