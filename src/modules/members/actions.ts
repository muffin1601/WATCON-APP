"use server";

import { runAction } from "@/lib/actions";
import { createMember, issueMemberResetLink, resetMemberPassword, setMemberStatus, updateMember } from "./service";

export async function createMemberAction(input: unknown) {
  return runAction(async (actor) => {
    const user = await createMember(actor, input);
    return { id: user!.id };
  }, ["/team-members", "/departments", "/dashboard"]);
}

export async function updateMemberAction(id: string, input: unknown) {
  return runAction(async (actor) => {
    const user = await updateMember(actor, String(id), input);
    return { id: user!.id };
  }, ["/team-members", "/departments", "/tasks"]);
}

export async function setMemberStatusAction(id: string, status: "ACTIVE" | "INACTIVE") {
  return runAction(async (actor) => {
    await setMemberStatus(actor, String(id), status === "ACTIVE" ? "ACTIVE" : "INACTIVE");
  }, ["/team-members", "/dashboard"]);
}

export async function issueMemberResetLinkAction(id: string) {
  return runAction(async (actor) => ({ link: await issueMemberResetLink(actor, String(id)) }));
}

export async function resetMemberPasswordAction(id: string, input: unknown) {
  return runAction(async (actor) => {
    await resetMemberPassword(actor, String(id), input);
  }, ["/team-members"]);
}
