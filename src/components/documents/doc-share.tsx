"use client";

import { FileDown, Mail, Printer } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { whatsappLink } from "@/lib/whatsapp";

/**
 * PDF / print / share for a commercial document. WhatsApp and email open the user's own app
 * with a prefilled message — the app never claims anything was sent (attach the PDF manually).
 */
export function DocShare({ type, id, summary, phone, email, subject }: { type: string; id: string; summary: string; phone?: string | null; email?: string | null; subject: string }) {
  const pdf = `/api/documents/pdf?type=${type}&id=${id}`;
  return (
    <>
      <Button asChild size="sm" variant="outline">
        <a href={`${pdf}&inline=1`} target="_blank" rel="noopener">
          <Printer /> Print
        </a>
      </Button>
      <Button asChild size="sm" variant="outline">
        <a href={pdf} download>
          <FileDown /> PDF
        </a>
      </Button>
      <Button asChild size="sm" variant="outline" title="Opens WhatsApp with a prefilled message. Attach the downloaded PDF before sending.">
        <a href={whatsappLink(summary, phone)} target="_blank" rel="noopener noreferrer">
          <WhatsAppIcon className="size-4" /> WhatsApp
        </a>
      </Button>
      <Button asChild size="sm" variant="outline" title="Opens your email app. Attach the downloaded PDF before sending.">
        <a href={`mailto:${email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(summary)}`}>
          <Mail /> Email
        </a>
      </Button>
    </>
  );
}
