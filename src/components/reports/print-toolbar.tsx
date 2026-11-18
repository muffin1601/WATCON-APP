"use client";

import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintToolbar() {
  return (
    <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 px-2">
      <p className="text-sm text-muted-foreground">A4 print preview — use “Save as PDF” in the print dialog or Export PDF from the app.</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => window.close()}>
          <X /> Close
        </Button>
        <Button size="sm" onClick={() => window.print()} data-testid="print-button">
          <Printer /> Print
        </Button>
      </div>
    </div>
  );
}
