import { describe, expect, it } from "vitest";
import { formatCode } from "@/lib/codes";
import { buildTaskSummary, normalizeWhatsAppNumber, whatsappLink } from "@/lib/whatsapp";
import { projectInputSchema } from "@/modules/projects/validation";
import { memberCreateSchema } from "@/modules/members/validation";
import { buildTaskOrderBy, buildTaskWhere } from "@/modules/tasks/filters";
import { taskInputSchema, taskListQuerySchema } from "@/modules/tasks/validation";
import { passwordPolicy } from "@/lib/auth/password-policy";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const P = "33333333-3333-4333-8333-333333333333";

describe("business codes", () => {
  it("formats with zero padding and grows past the width", () => {
    expect(formatCode("PROJECT", 7)).toBe("PRJ-0007");
    expect(formatCode("TASK", 42)).toBe("TSK-00042");
    expect(formatCode("DEPARTMENT", 1)).toBe("DEP-001");
    expect(formatCode("EMPLOYEE", 12345)).toBe("EMP-12345");
    expect(() => formatCode("TASK", 0)).toThrow();
  });
});

describe("project validation", () => {
  const valid = { name: "Site A", siteAddress: "Addr", description: "Desc", priority: "HIGH", status: "ACTIVE" };
  it("accepts minimal input and defaults optional fields", () => {
    const r = projectInputSchema.parse(valid);
    expect(r.startDate).toBeNull();
    expect(r.memberIds).toEqual([]);
  });
  it("requires name, address and description; rejects bad dates and ordering", () => {
    expect(projectInputSchema.safeParse({ ...valid, name: "  " }).success).toBe(false);
    expect(projectInputSchema.safeParse({ ...valid, startDate: "2026-02-30" }).success).toBe(false);
    expect(projectInputSchema.safeParse({ ...valid, startDate: "2026-05-01", expectedCompletionDate: "2026-04-01" }).success).toBe(false);
  });
});

describe("task validation", () => {
  const base = { title: "Install panel", projectId: P, priority: "HIGH", status: "TODO", progress: 0, assigneeIds: [U1, U2], ownerId: U1 };
  it("owner must be an assignee", () => {
    expect(taskInputSchema.safeParse(base).success).toBe(true);
    expect(taskInputSchema.safeParse({ ...base, ownerId: "44444444-4444-4444-8444-444444444444" }).success).toBe(false);
    expect(taskInputSchema.safeParse({ ...base, ownerId: null }).success).toBe(false);
  });
  it("due date cannot precede start date; progress within 0-100; no duplicates", () => {
    expect(taskInputSchema.safeParse({ ...base, startDate: "2026-11-10", dueDate: "2026-11-09" }).success).toBe(false);
    expect(taskInputSchema.safeParse({ ...base, progress: 150 }).success).toBe(false);
    expect(taskInputSchema.safeParse({ ...base, assigneeIds: [U1, U1] }).success).toBe(false);
    expect(taskInputSchema.safeParse({ ...base, projectId: "" }).success).toBe(false);
  });
  it("list query ignores junk values instead of failing", () => {
    const q = taskListQuerySchema.parse({ status: "IN_PROGRESS,BOGUS", sort: "hack", page: "-5", pageSize: "9999" });
    expect(q.status).toBeUndefined();
    expect(q.sort).toBe("dueDate");
    expect(q.page).toBe(1);
    expect(q.pageSize).toBe(25);
    expect(taskListQuerySchema.parse({ status: "TODO,BLOCKED" }).status).toEqual(["TODO", "BLOCKED"]);
  });
});

describe("member & password validation", () => {
  it("enforces password policy", () => {
    expect(passwordPolicy.safeParse("short1").success).toBe(false);
    expect(passwordPolicy.safeParse("longpasswordnodigit").success).toBe(false);
    expect(passwordPolicy.safeParse("Good-password-1").success).toBe(true);
  });
  it("normalises email/username and limits roles", () => {
    const r = memberCreateSchema.parse({ fullName: "Neha", email: "NEHA@X.COM", username: "Neha.V", role: "USER", password: "Good-password-1" });
    expect(r.email).toBe("neha@x.com");
    expect(r.username).toBe("neha.v");
    expect(memberCreateSchema.safeParse({ fullName: "Neha", email: "a@b.co", username: "neha", role: "SUPER_ADMIN", password: "Good-password-1" }).success).toBe(false);
  });
});

describe("task filters", () => {
  const actor = { id: U1, organizationId: "o1", role: "USER" as const, permissions: [] };
  it("always starts with the visibility scope and AND-s every filter", () => {
    const today = new Date("2026-11-17T00:00:00Z");
    const w = buildTaskWhere(actor, { projectId: P, departmentId: U2, status: ["IN_PROGRESS"], overdue: "1", assigned: "unassigned", q: "panel" }, today) as { AND: Record<string, unknown>[] };
    expect(w.AND[0]).toMatchObject({ organizationId: "o1" });
    expect(w.AND).toHaveLength(7);
    expect(w.AND).toContainEqual({ dueDate: { lt: today }, status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] } });
    expect(w.AND).toContainEqual({ assignees: { none: {} } });
  });
  it("sorts multi-value columns by maintained keys with nulls last and a stable tie-breaker", () => {
    expect(buildTaskOrderBy("department", "asc")).toEqual([{ departmentSortKey: { sort: "asc", nulls: "last" } }, { code: "asc" }]);
    expect(buildTaskOrderBy("priority", "desc")).toEqual([{ priority: "desc" }, { code: "asc" }]);
  });
});

describe("whatsapp", () => {
  it("normalises numbers", () => {
    expect(normalizeWhatsAppNumber("98765 43210")).toBe("919876543210");
    expect(normalizeWhatsAppNumber("+91-98765-43210")).toBe("919876543210");
    expect(normalizeWhatsAppNumber("098765 43210")).toBe("919876543210");
    expect(normalizeWhatsAppNumber("12")).toBeNull();
  });
  it("builds wa.me links with encoded text", () => {
    expect(whatsappLink("Hi & bye", "9876543210")).toBe("https://wa.me/919876543210?text=Hi%20%26%20bye");
    expect(whatsappLink("x")).toBe("https://wa.me/?text=x");
  });
  it("caps message length and points to the PDF", () => {
    const tasks = Array.from({ length: 200 }, (_, i) => ({ code: `TSK-${i}`, title: "A fairly long task title for testing length limits", status: "TODO", priority: "HIGH", progress: 0, dueDate: null }));
    const text = buildTaskSummary({ heading: "H", tasks });
    expect(text.length).toBeLessThanOrEqual(3000);
    expect(text).toContain("more task(s)");
  });
});
