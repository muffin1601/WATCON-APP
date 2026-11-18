"use server";

import { runAction } from "@/lib/actions";
import { addDepartmentMember, createDepartment, removeDepartmentMember, setDepartmentStatus, updateDepartment } from "./service";

export async function createDepartmentAction(input: unknown) {
  return runAction(async (actor) => ({ id: (await createDepartment(actor, input)).id }), ["/departments", "/dashboard"]);
}

export async function updateDepartmentAction(id: string, input: unknown) {
  return runAction(async (actor) => ({ id: (await updateDepartment(actor, String(id), input)).id }), ["/departments", "/tasks"]);
}

export async function setDepartmentStatusAction(id: string, status: "ACTIVE" | "INACTIVE") {
  return runAction(async (actor) => {
    await setDepartmentStatus(actor, String(id), status === "ACTIVE" ? "ACTIVE" : "INACTIVE");
  }, ["/departments", "/dashboard"]);
}

export async function addDepartmentMemberAction(input: unknown) {
  return runAction(async (actor) => {
    await addDepartmentMember(actor, input);
  }, ["/departments", "/team-members"]);
}

export async function removeDepartmentMemberAction(input: unknown) {
  return runAction(async (actor) => {
    await removeDepartmentMember(actor, input);
  }, ["/departments", "/team-members"]);
}
