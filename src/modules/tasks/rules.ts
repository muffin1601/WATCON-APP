/**
 * Task status / progress rules — pure functions, unit tested.
 *
 *  R1  COMPLETED ⇔ progress = 100. Completing forces 100; reaching 100 auto-completes.
 *  R2  TODO means not started: an explicit TODO status requires progress 0.
 *      Raising progress above 0 on a TODO task (status not supplied) moves it to IN_PROGRESS.
 *  R3  Reopening (COMPLETED → TODO / IN_PROGRESS / BLOCKED) requires an explicit progress < 100.
 *  R4  CANCELLED keeps its progress (< 100) and is excluded from completion-rate denominators.
 *      Reaching 100 on a CANCELLED or BLOCKED task is rejected — change the status explicitly.
 *  R5  completedAt is set when entering COMPLETED and cleared when leaving it.
 *  R6  Progress is an integer 0–100.
 */

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type TaskState = { status: TaskStatus; progress: number; completedAt: Date | null };
export type TaskChange = { status?: TaskStatus; progress?: number };

export type TransitionResult =
  | { ok: true; state: TaskState; completed: boolean; reopened: boolean }
  | { ok: false; error: string; field: "status" | "progress" };

export function applyTaskTransition(prev: TaskState, change: TaskChange, now: Date = new Date()): TransitionResult {
  if (change.progress !== undefined && (!Number.isInteger(change.progress) || change.progress < 0 || change.progress > 100)) {
    return { ok: false, error: "Progress must be a whole number between 0 and 100.", field: "progress" };
  }

  let status: TaskStatus = change.status ?? prev.status;
  let progress = change.progress ?? prev.progress;

  // R1 — explicit completion.
  if (change.status === "COMPLETED") {
    progress = 100;
  } else if (progress === 100 && change.status === undefined) {
    // R1 / R4 — reaching 100 without an explicit status.
    if (status === "CANCELLED" || status === "BLOCKED") {
      return { ok: false, error: `A ${status === "CANCELLED" ? "cancelled" : "blocked"} task cannot be at 100%. Change its status first.`, field: "progress" };
    }
    status = "COMPLETED";
  }

  // R3 — reopening.
  const reopening = prev.status === "COMPLETED" && status !== "COMPLETED";
  if (reopening && status !== "CANCELLED") {
    if (change.progress === undefined) {
      return { ok: false, error: "Set a progress value below 100% when reopening a completed task.", field: "progress" };
    }
  }
  if (status !== "COMPLETED" && progress === 100) {
    return { ok: false, error: "Only completed tasks can be at 100%. Choose a lower progress value.", field: "progress" };
  }

  // R2 — not-started semantics.
  if (status === "TODO" && progress > 0) {
    if (change.status === "TODO") {
      return { ok: false, error: "A To Do task must be at 0%. Use In Progress for started work.", field: "status" };
    }
    status = "IN_PROGRESS";
  }

  const completedAt = status === "COMPLETED" ? (prev.status === "COMPLETED" ? prev.completedAt ?? now : now) : null;
  return {
    ok: true,
    state: { status, progress, completedAt },
    completed: status === "COMPLETED" && prev.status !== "COMPLETED",
    reopened: reopening,
  };
}

/** Completion rate in whole percent. Cancelled tasks are excluded from the denominator. */
export function completionRate(counts: { total: number; completed: number; cancelled: number }): number {
  const denominator = counts.total - counts.cancelled;
  if (denominator <= 0) return 0;
  return Math.round((counts.completed / denominator) * 100);
}

/** Overdue = has a due date before today and is not completed/cancelled. */
export function isOverdue(task: { dueDate: Date | null; status: TaskStatus }, today: Date = startOfToday()): boolean {
  if (!task.dueDate || task.status === "COMPLETED" || task.status === "CANCELLED") return false;
  return task.dueDate.getTime() < today.getTime();
}

/**
 * Today's calendar date in the business time zone (APP_TIMEZONE, default Asia/Kolkata),
 * expressed as UTC midnight — the same representation Postgres DATE columns use.
 */
export function startOfToday(now: Date = new Date(), timeZone: string = process.env.APP_TIMEZONE || "Asia/Kolkata"): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return new Date(`${parts}T00:00:00.000Z`);
}

export const OPEN_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED"];
