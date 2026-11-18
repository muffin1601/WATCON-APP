"use server";

import { runAction } from "@/lib/actions";
import { addStatusUpdate, createProject, setProjectArchived, updateProject } from "./service";

export async function createProjectAction(input: unknown) {
  return runAction(async (actor) => ({ id: (await createProject(actor, input)).id }), ["/projects", "/dashboard"]);
}

export async function updateProjectAction(id: string, input: unknown) {
  return runAction(async (actor) => ({ id: (await updateProject(actor, String(id), input)).id }), ["/projects", "/dashboard"]);
}

export async function setProjectArchivedAction(id: string, archived: boolean) {
  return runAction(async (actor) => {
    await setProjectArchived(actor, String(id), Boolean(archived));
  }, ["/projects", "/dashboard"]);
}

export async function addStatusUpdateAction(input: unknown) {
  return runAction(async (actor) => {
    await addStatusUpdate(actor, input);
  }, ["/projects"]);
}
