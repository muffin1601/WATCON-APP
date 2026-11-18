import { z } from "zod";
import { PRIORITIES, optionalDate, optionalText, text, uuid } from "@/lib/validations/common";
import { TASK_STATUSES } from "./rules";

const progress = z.coerce
  .number({ error: "Progress must be a number." })
  .int("Progress must be a whole number.")
  .min(0, "Progress cannot be below 0.")
  .max(100, "Progress cannot exceed 100.");

export const taskInputSchema = z
  .object({
    title: text("Task title", 200, 3),
    description: optionalText("Task description", 10000),
    projectId: uuid.or(z.literal("")).refine((v) => v !== "", "Select a project."),
    departmentIds: z.array(uuid).max(30).default([]),
    assigneeIds: z.array(uuid).max(50).default([]),
    ownerId: z.union([uuid, z.literal(""), z.null()]).optional().transform((v) => (v ? v : null)),
    startDate: optionalDate,
    dueDate: optionalDate,
    priority: z.enum(PRIORITIES),
    status: z.enum(TASK_STATUSES),
    progress,
  })
  .superRefine((v, ctx) => {
    if (v.startDate && v.dueDate && v.dueDate < v.startDate) {
      ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Due date cannot be earlier than the start date." });
    }
    if (v.ownerId && !v.assigneeIds.includes(v.ownerId)) {
      ctx.addIssue({ code: "custom", path: ["ownerId"], message: "The accountable owner must be one of the assigned team members." });
    }
    if (v.assigneeIds.length && !v.ownerId) {
      ctx.addIssue({ code: "custom", path: ["ownerId"], message: "Select an accountable owner from the assigned members." });
    }
    if (new Set(v.assigneeIds).size !== v.assigneeIds.length) {
      ctx.addIssue({ code: "custom", path: ["assigneeIds"], message: "A team member is selected more than once." });
    }
    if (new Set(v.departmentIds).size !== v.departmentIds.length) {
      ctx.addIssue({ code: "custom", path: ["departmentIds"], message: "A department is selected more than once." });
    }
  });

export type TaskInput = z.input<typeof taskInputSchema>;
export type TaskData = z.output<typeof taskInputSchema>;

export const taskUpdateSchema = z.object({ version: z.coerce.number().int().min(1), data: z.unknown() });

export const progressUpdateSchema = z
  .object({
    taskId: uuid,
    version: z.coerce.number().int().min(1),
    status: z.enum(TASK_STATUSES).optional(),
    progress: progress.optional(),
  })
  .refine((v) => v.status !== undefined || v.progress !== undefined, { message: "Change the status or the progress.", path: ["progress"] });

export const commentSchema = z.object({ taskId: uuid, body: text("Comment", 4000) });

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const csv = <T extends string>(values: readonly [T, ...T[]]) =>
  z
    .string()
    .transform((s) => s.split(",").filter(Boolean))
    .pipe(z.array(z.enum(values)))
    .optional()
    .catch(undefined);

export const TASK_SORTS = ["dueDate", "createdAt", "project", "department", "assignee", "priority", "status", "code", "title", "updatedAt"] as const;

export const taskListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  projectId: uuid.optional().catch(undefined),
  departmentId: uuid.optional().catch(undefined),
  assigneeId: uuid.optional().catch(undefined),
  status: csv(TASK_STATUSES),
  priority: csv(PRIORITIES),
  createdFrom: isoDay.optional().catch(undefined),
  createdTo: isoDay.optional().catch(undefined),
  dueFrom: isoDay.optional().catch(undefined),
  dueTo: isoDay.optional().catch(undefined),
  overdue: z.enum(["1"]).optional().catch(undefined),
  assigned: z.enum(["assigned", "unassigned"]).optional().catch(undefined),
  mine: z.enum(["1"]).optional().catch(undefined),
  sort: z.enum(TASK_SORTS).catch("dueDate").default("dueDate"),
  dir: z.enum(["asc", "desc"]).catch("asc").default("asc"),
  page: z.coerce.number().int().min(1).catch(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).catch(25).default(25),
});
export type TaskListQuery = z.output<typeof taskListQuerySchema>;
