"use server";

import { runAction } from "@/lib/actions";
import { deleteAttachment, verifyAttachment } from "./attachments";

export async function verifyAttachmentAction(id: string, input: unknown) {
  return runAction(async (actor) => {
    await verifyAttachment(actor, String(id), input);
  });
}

export async function deleteAttachmentAction(id: string, input: unknown) {
  return runAction(async (actor) => {
    await deleteAttachment(actor, String(id), input);
  });
}
