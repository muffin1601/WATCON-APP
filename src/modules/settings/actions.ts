"use server";

import { runAction } from "@/lib/actions";
import { updateCompany, updateRolePermissions } from "./service";

export async function updateCompanyAction(input: unknown) {
  return runAction(async (actor) => {
    await updateCompany(actor, input);
  }, ["/"]);
}

export async function updateRolePermissionsAction(input: unknown) {
  return runAction(async (actor) => {
    await updateRolePermissions(actor, input);
  }, ["/settings"]);
}
