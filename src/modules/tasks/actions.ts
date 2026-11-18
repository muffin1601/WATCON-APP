"use server";

import { runAction } from "@/lib/actions";
import { ValidationError } from "@/lib/errors";
import { addComment, createTask, updateTask, updateTaskProgress } from "./service";

const PATHS = ["/tasks", "/projects", "/dashboard", "/departments", "/team-members"];

export async function createTaskAction(input: unknown) {
  return runAction(async (actor) => ({ id: (await createTask(actor, input)).id }), PATHS);
}

export async function updateTaskAction(id: string, input: { version: number; data: unknown }) {
  return runAction(async (actor) => {
    const version = Number(input?.version);
    if (!Number.isInteger(version) || version < 1) throw new ValidationError("Invalid task version. Reload and try again.");
    const task = await updateTask(actor, String(id), { version, data: input?.data });
    return { id: task.id };
  }, PATHS);
}

export async function updateTaskProgressAction(input: unknown) {
  return runAction(async (actor) => {
    const task = await updateTaskProgress(actor, input);
    return { status: task.status as string, progress: task.progress, version: task.version };
  }, PATHS);
}

export async function addCommentAction(input: unknown) {
  return runAction(async (actor) => {
    await addComment(actor, input);
  }, ["/tasks"]);
}
