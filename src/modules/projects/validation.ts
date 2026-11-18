import { z } from "zod";
import { PRIORITIES, optionalDate, text, uuid } from "@/lib/validations/common";

export const PROJECT_STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;
export type ProjectStatusKey = (typeof PROJECT_STATUSES)[number];

export const projectInputSchema = z
  .object({
    name: text("Site / project name", 160),
    siteAddress: text("Site address", 500),
    description: text("Project description", 5000),
    startDate: optionalDate,
    expectedCompletionDate: optionalDate,
    priority: z.enum(PRIORITIES),
    status: z.enum(PROJECT_STATUSES),
    managerId: z.union([uuid, z.literal(""), z.null()]).optional().transform((v) => (v ? v : null)),
    memberIds: z.array(uuid).max(200).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.startDate && v.expectedCompletionDate && v.expectedCompletionDate < v.startDate) {
      ctx.addIssue({ code: "custom", path: ["expectedCompletionDate"], message: "Expected completion cannot be before the start date." });
    }
  });

export type ProjectInput = z.input<typeof projectInputSchema>;
export type ProjectData = z.output<typeof projectInputSchema>;

export const statusUpdateSchema = z.object({
  projectId: uuid,
  body: text("Status update", 5000, 3),
});

export const projectListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(PROJECT_STATUSES).optional().catch(undefined),
  archived: z.enum(["only", "include"]).optional().catch(undefined),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  sort: z.enum(["code", "name", "status", "updatedAt", "createdAt", "startDate"]).catch("updatedAt").default("updatedAt"),
  dir: z.enum(["asc", "desc"]).catch("desc").default("desc"),
  page: z.coerce.number().int().min(1).catch(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).catch(20).default(20),
});
export type ProjectListQuery = z.output<typeof projectListQuerySchema>;
