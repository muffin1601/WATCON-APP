import { isOverdue, type TaskStatus } from "./rules";

/** Serializable task row for client tables (shared by every task list in the app). */
export type TaskRowData = {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  progress: number;
  startDate: string | null;
  dueDate: string | null;
  overdue: boolean;
  project: { id: string; name: string; code: string };
  departments: { id: string; name: string }[];
  assignees: { id: string; fullName: string }[];
  ownerId: string | null;
};

type Source = {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  progress: number;
  startDate: Date | null;
  dueDate: Date | null;
  project: { id: string; name: string; code: string };
  owner: { id: string } | null;
  departments: { department: { id: string; name: string } }[];
  assignees: { user: { id: string; fullName: string } }[];
};

export function toTaskRow(t: Source, today?: Date): TaskRowData {
  return {
    id: t.id,
    code: t.code,
    title: t.title,
    status: t.status,
    priority: t.priority,
    progress: t.progress,
    startDate: t.startDate?.toISOString() ?? null,
    dueDate: t.dueDate?.toISOString() ?? null,
    overdue: isOverdue({ dueDate: t.dueDate, status: t.status as TaskStatus }, today),
    project: t.project,
    departments: t.departments.map((d) => d.department),
    assignees: t.assignees.map((a) => a.user),
    ownerId: t.owner?.id ?? null,
  };
}
