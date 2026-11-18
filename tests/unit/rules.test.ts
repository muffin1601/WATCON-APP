import { describe, expect, it } from "vitest";
import { applyTaskTransition, completionRate, isOverdue, startOfToday, type TaskState } from "@/modules/tasks/rules";

const now = new Date("2026-11-17T10:00:00Z");
const todo: TaskState = { status: "TODO", progress: 0, completedAt: null };
const done: TaskState = { status: "COMPLETED", progress: 100, completedAt: new Date("2026-11-10T00:00:00Z") };

describe("applyTaskTransition", () => {
  it("completing forces 100% and sets completedAt", () => {
    const r = applyTaskTransition({ status: "IN_PROGRESS", progress: 40, completedAt: null }, { status: "COMPLETED" }, now);
    expect(r).toMatchObject({ ok: true, completed: true, state: { status: "COMPLETED", progress: 100, completedAt: now } });
  });
  it("reaching 100% auto-completes", () => {
    const r = applyTaskTransition({ status: "IN_PROGRESS", progress: 40, completedAt: null }, { progress: 100 }, now);
    expect(r.ok && r.state.status).toBe("COMPLETED");
  });
  it("raising progress on a To Do task starts it", () => {
    const r = applyTaskTransition(todo, { progress: 20 }, now);
    expect(r.ok && r.state.status).toBe("IN_PROGRESS");
  });
  it("rejects an explicit To Do with progress", () => {
    expect(applyTaskTransition(todo, { status: "TODO", progress: 20 }, now).ok).toBe(false);
  });
  it("reopening requires progress below 100", () => {
    expect(applyTaskTransition(done, { status: "IN_PROGRESS" }, now)).toMatchObject({ ok: false, field: "progress" });
    expect(applyTaskTransition(done, { status: "IN_PROGRESS", progress: 100 }, now).ok).toBe(false);
    const r = applyTaskTransition(done, { status: "IN_PROGRESS", progress: 70 }, now);
    expect(r).toMatchObject({ ok: true, reopened: true, state: { completedAt: null, progress: 70 } });
  });
  it("blocked/cancelled tasks cannot reach 100% without a status change", () => {
    expect(applyTaskTransition({ status: "BLOCKED", progress: 50, completedAt: null }, { progress: 100 }, now).ok).toBe(false);
    expect(applyTaskTransition({ status: "CANCELLED", progress: 50, completedAt: null }, { progress: 100 }, now).ok).toBe(false);
  });
  it("validates progress bounds", () => {
    expect(applyTaskTransition(todo, { progress: -1 }, now).ok).toBe(false);
    expect(applyTaskTransition(todo, { progress: 101 }, now).ok).toBe(false);
    expect(applyTaskTransition(todo, { progress: 2.5 }, now).ok).toBe(false);
  });
  it("keeps the original completion time when already completed", () => {
    const r = applyTaskTransition(done, {}, now);
    expect(r.ok && r.state.completedAt).toEqual(done.completedAt);
  });
});

describe("completionRate", () => {
  it("excludes cancelled tasks from the denominator", () => {
    expect(completionRate({ total: 10, completed: 4, cancelled: 2 })).toBe(50);
    expect(completionRate({ total: 2, completed: 0, cancelled: 2 })).toBe(0);
    expect(completionRate({ total: 0, completed: 0, cancelled: 0 })).toBe(0);
  });
});

describe("overdue", () => {
  const today = new Date("2026-11-17T00:00:00Z");
  it("only open tasks with a past due date are overdue", () => {
    expect(isOverdue({ dueDate: new Date("2026-11-16T00:00:00Z"), status: "IN_PROGRESS" }, today)).toBe(true);
    expect(isOverdue({ dueDate: new Date("2026-11-17T00:00:00Z"), status: "IN_PROGRESS" }, today)).toBe(false);
    expect(isOverdue({ dueDate: new Date("2026-11-01T00:00:00Z"), status: "COMPLETED" }, today)).toBe(false);
    expect(isOverdue({ dueDate: null, status: "TODO" }, today)).toBe(false);
  });
  it("uses the business time zone for 'today'", () => {
    // 20:00 UTC on the 17th is already the 18th in India.
    expect(startOfToday(new Date("2026-11-17T20:00:00Z"), "Asia/Kolkata").toISOString()).toBe("2026-11-18T00:00:00.000Z");
    expect(startOfToday(new Date("2026-11-17T20:00:00Z"), "UTC").toISOString()).toBe("2026-11-17T00:00:00.000Z");
  });
});
