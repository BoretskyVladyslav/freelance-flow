"use client";

import { useRef, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/components/finance/finance-provider";
import { formatDate, formatMoney } from "@/lib/format";
import { PLATFORM_LABELS, STATUS_LABELS } from "@/lib/labels";
import { convertToDisplay } from "@/lib/tax-calculator";
import { getTransactionStartDate } from "@/types/finance";

const cellStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: "8px 6px",
  textAlign: "left",
  verticalAlign: "top",
};

export function PdfReportButton() {
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const { views, displayTotals, displayCurrency, rates } = useFinance();

  async function exportPdf() {
    const report = reportRef.current;
    if (!report || exporting) return;
    setExporting(true);
    const toastId = toast.loading("Формування PDF-звіту…");

    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(report, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = 190;
      const pageHeight = 277;
      const imageHeight = (canvas.height * pageWidth) / canvas.width;
      const image = canvas.toDataURL("image/png");

      for (let offset = 0, page = 0; offset < imageHeight; offset += pageHeight, page += 1) {
        if (page > 0) pdf.addPage();
        pdf.addImage(image, "PNG", 10, 10 - offset, pageWidth, imageHeight);
      }

      pdf.save(`freelance-flow-zvit-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF-звіт збережено.", { id: toastId });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не вдалося сформувати PDF-звіт.",
        { id: toastId },
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={exportPdf} disabled={exporting}>
        {exporting ? <Loader2 className="animate-spin" /> : <FileText />}
        Звіт у PDF
      </Button>

      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          left: "-10000px",
          top: 0,
          width: "794px",
          background: "#ffffff",
          color: "#111827",
          fontFamily: "Arial, sans-serif",
          padding: "44px",
          zIndex: -1,
        }}
      >
        <div ref={reportRef}>
          <header style={{ marginBottom: "28px" }}>
            <div style={{ color: "#64748b", fontSize: "12px", letterSpacing: "1.5px" }}>
              ФІНАНСОВА CRM
            </div>
            <h1 style={{ fontSize: "28px", margin: "6px 0" }}>Freelance Flow — фінансовий звіт</h1>
            <div style={{ color: "#64748b", fontSize: "13px" }}>
              Сформовано {formatDate(new Date().toISOString())} · Валюта звіту: {displayCurrency}
            </div>
          </header>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              marginBottom: "28px",
            }}
          >
            {[
              ["Загальний дохід (Gross)", displayTotals.grossInBase],
              ["Податок в Іспанії (19%)", displayTotals.spainTax],
              ["Податок фірми (30%)", displayTotals.companyTax],
              ["Чистий дохід (Net)", displayTotals.netPayout],
            ].map(([label, amount]) => (
              <div
                key={String(label)}
                style={{
                  border: "1px solid #dbe2ea",
                  borderRadius: "8px",
                  padding: "14px",
                }}
              >
                <div style={{ color: "#64748b", fontSize: "12px" }}>{label}</div>
                <div style={{ fontSize: "20px", fontWeight: 700, marginTop: "5px" }}>
                  {formatMoney(Number(amount), displayCurrency)}
                </div>
              </div>
            ))}
          </section>

          <h2 style={{ fontSize: "18px", margin: "0 0 10px" }}>Список проєктів</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                <th style={cellStyle}>Дата</th>
                <th style={cellStyle}>Проєкт</th>
                <th style={cellStyle}>Платформа</th>
                <th style={cellStyle}>Gross</th>
                <th style={cellStyle}>Net</th>
                <th style={cellStyle}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {views.map((row) => (
                <tr key={row.id}>
                  <td style={cellStyle}>{formatDate(getTransactionStartDate(row))}</td>
                  <td style={cellStyle}>{row.title}</td>
                  <td style={cellStyle}>{PLATFORM_LABELS[row.platform]}</td>
                  <td style={cellStyle}>{formatMoney(row.grossAmount, row.currency)}</td>
                  <td style={cellStyle}>
                    {formatMoney(
                      convertToDisplay(row.breakdown.netPayout, displayCurrency, rates),
                      displayCurrency,
                    )}
                  </td>
                  <td style={cellStyle}>{STATUS_LABELS[row.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {views.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: "13px" }}>Проєкти ще не додані.</p>
          ) : null}
        </div>
      </div>
    </>
  );
}
