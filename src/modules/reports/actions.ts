"use server";

import { runAction } from "@/lib/actions";
import { getReport, reportWhatsAppText } from "./service";

/** Returns the WhatsApp summary text for a report the caller is authorized to view. */
export async function whatsappShareAction(params: Record<string, string>) {
  return runAction(async (actor) => {
    const safe = Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => typeof v === "string").slice(0, 30));
    const report = await getReport(actor, safe);
    return { text: reportWhatsAppText(report), phone: report.whatsappPhone, title: report.title, subject: report.subject };
  });
}
