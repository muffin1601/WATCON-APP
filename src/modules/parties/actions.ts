"use server";

import { runAction } from "@/lib/actions";
import { createParty, updateParty } from "./service";

export async function createPartyAction(input: unknown) {
  return runAction(async (actor) => ({ id: (await createParty(actor, input)).id }), ["/parties"]);
}

export async function updatePartyAction(id: string, input: unknown) {
  return runAction(async (actor) => ({ id: (await updateParty(actor, String(id), input)).id }), ["/parties"]);
}
