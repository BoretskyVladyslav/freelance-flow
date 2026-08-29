"use client";

import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PdfReportButton() {
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
      <FileText />
      Звіт у PDF
    </Button>
  );
}
