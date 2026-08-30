import {
  PLATFORM_LABELS,
  STATUS_LABELS,
} from "@/lib/labels";
import { formatDate, formatMoney } from "@/lib/format";
import { convertToDisplay } from "@/lib/tax-calculator";
import {
  getTransactionStartDate,
  type Currency,
  type ExchangeRates,
  type LedgerFilters,
} from "@/types/finance";
import type { DashboardTotals, TransactionView } from "@/lib/aggregates";

const NAVY: [number, number, number] = [30, 58, 138];
const EMERALD: [number, number, number] = [16, 185, 129];
const ROSE: [number, number, number] = [225, 29, 72];

export type PdfReportInput = {
  views: TransactionView[];
  totals: DashboardTotals;
  displayCurrency: Currency;
  rates: ExchangeRates | null;
  filters: LedgerFilters;
};

export function describeFilterRange(filters: LedgerFilters): string {
  const platform =
    filters.platform === "all" ? "All platforms" : PLATFORM_LABELS[filters.platform];
  const status = filters.status === "all" ? "All statuses" : STATUS_LABELS[filters.status];
  const month = filters.month === "all" ? "All months" : filters.month;
  const week = filters.week === "all" ? "All weeks" : filters.week.replace("-W", " W");
  return `${platform} · ${status} · ${month} · ${week}`;
}

export function pdfFileName(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 10);
  return `FreelanceFlow_Report_${stamp}.pdf`;
}

export function buildPdfTableRows(
  views: TransactionView[],
  displayCurrency: Currency,
  rates: ExchangeRates | null,
): string[][] {
  return views.map((row) => [
    formatDate(getTransactionStartDate(row)),
    row.title,
    PLATFORM_LABELS[row.platform],
    formatMoney(row.grossAmount, row.currency),
    formatMoney(convertToDisplay(row.breakdown.spainTax, displayCurrency, rates), displayCurrency),
    formatMoney(convertToDisplay(row.breakdown.companyTax, displayCurrency, rates), displayCurrency),
    formatMoney(convertToDisplay(row.breakdown.netPayout, displayCurrency, rates), displayCurrency),
    STATUS_LABELS[row.status],
  ]);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

async function registerRoboto(doc: import("jspdf").jsPDF): Promise<void> {
  const [regular, bold] = await Promise.all([
    fetch("/fonts/Roboto-Regular.ttf").then((response) => {
      if (!response.ok) throw new Error("Roboto Regular missing.");
      return response.arrayBuffer();
    }),
    fetch("/fonts/Roboto-Medium.ttf").then((response) => {
      if (!response.ok) throw new Error("Roboto Medium missing.");
      return response.arrayBuffer();
    }),
  ]);
  doc.addFileToVFS("Roboto-Regular.ttf", arrayBufferToBase64(regular));
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFileToVFS("Roboto-Medium.ttf", arrayBufferToBase64(bold));
  doc.addFont("Roboto-Medium.ttf", "Roboto", "bold");
  doc.setFont("Roboto", "normal");
}

export async function downloadPdfReport(input: PdfReportInput): Promise<string> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  await registerRoboto(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("Roboto", "bold");
  doc.setFontSize(16);
  doc.text("Freelance Flow Financial Summary", 14, 14);

  doc.setTextColor(30, 41, 59);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(10);
  const generated = formatDate(new Date().toISOString());
  doc.text(`Generated: ${generated}  ·  Display currency: ${input.displayCurrency}`, 14, 30);
  doc.setFontSize(9);
  doc.text(`Filter range: ${describeFilterRange(input.filters)}`, 14, 36);
  doc.text(`Projects in report: ${input.views.length}`, 14, 42);

  const kpis: Array<{ label: string; value: string; color: [number, number, number] }> = [
    {
      label: "Gross",
      value: formatMoney(input.totals.grossInBase, input.displayCurrency),
      color: NAVY,
    },
    {
      label: "19% Spain Tax",
      value: formatMoney(input.totals.spainTax, input.displayCurrency),
      color: ROSE,
    },
    {
      label: "30% Company Fee",
      value: formatMoney(input.totals.companyTax, input.displayCurrency),
      color: ROSE,
    },
    {
      label: "Net Profit",
      value: formatMoney(input.totals.netPayout, input.displayCurrency),
      color: EMERALD,
    },
  ];
  const boxWidth = (pageWidth - 14 * 2 - 9) / 4;
  kpis.forEach((kpi, index) => {
    const x = 14 + index * (boxWidth + 3);
    doc.setDrawColor(...kpi.color);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, 48, boxWidth, 18, 1.5, 1.5, "S");
    doc.setFont("Roboto", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + 3, 54);
    doc.setFont("Roboto", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, x + 3, 62);
  });

  const body = buildPdfTableRows(input.views, input.displayCurrency, input.rates);
  autoTable(doc, {
    startY: 72,
    head: [["Date", "Project", "Platform", "Gross (orig.)", "Spain 19%", "Company 30%", "Net", "Status"]],
    body,
    foot: [
      [
        "Totals",
        `${input.views.length} projects`,
        "",
        "",
        formatMoney(input.totals.spainTax, input.displayCurrency),
        formatMoney(input.totals.companyTax, input.displayCurrency),
        formatMoney(input.totals.netPayout, input.displayCurrency),
        "",
      ],
    ],
    showFoot: "lastPage",
    styles: {
      font: "Roboto",
      fontSize: 8,
      cellPadding: 2,
      overflow: "linebreak",
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: NAVY,
      textColor: 255,
      fontStyle: "bold",
      font: "Roboto",
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: NAVY,
      fontStyle: "bold",
      font: "Roboto",
    },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 62 },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right", textColor: EMERALD, fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });

  const fileName = pdfFileName();
  doc.save(fileName);
  return fileName;
}
