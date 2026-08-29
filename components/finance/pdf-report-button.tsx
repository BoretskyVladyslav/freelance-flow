"use client";

import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/components/finance/finance-provider";
import { formatDate, formatMoney } from "@/lib/format";
import { PLATFORM_LABELS, STATUS_LABELS } from "@/lib/labels";
import { convertToDisplay } from "@/lib/tax-calculator";
import { getTransactionStartDate } from "@/types/finance";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function PdfReportButton() {
  const { views, displayTotals, displayCurrency, rates } = useFinance();

  function printReport() {
    const reportWindow = window.open("", "_blank", "width=1000,height=800");
    if (!reportWindow) {
      toast.error("Браузер заблокував вікно звіту. Дозвольте спливні вікна.");
      return;
    }

    const metrics = [
      ["Загальний дохід (Gross)", displayTotals.grossInBase],
      ["Податок в Іспанії (19%)", displayTotals.spainTax],
      ["Податок фірми (30%)", displayTotals.companyTax],
      ["Чистий дохід (Net)", displayTotals.netPayout],
    ]
      .map(
        ([label, amount]) => `
          <section class="metric">
            <span>${escapeHtml(String(label))}</span>
            <strong>${escapeHtml(formatMoney(Number(amount), displayCurrency))}</strong>
          </section>`,
      )
      .join("");

    const rows =
      views.length === 0
        ? '<tr><td colspan="6" class="empty">Проєкти ще не додані.</td></tr>'
        : views
            .map(
              (row) => `
                <tr>
                  <td>${escapeHtml(formatDate(getTransactionStartDate(row)))}</td>
                  <td>${escapeHtml(row.title)}</td>
                  <td>${escapeHtml(PLATFORM_LABELS[row.platform])}</td>
                  <td>${escapeHtml(formatMoney(row.grossAmount, row.currency))}</td>
                  <td>${escapeHtml(
                    formatMoney(
                      convertToDisplay(row.breakdown.netPayout, displayCurrency, rates),
                      displayCurrency,
                    ),
                  )}</td>
                  <td>${escapeHtml(STATUS_LABELS[row.status])}</td>
                </tr>`,
            )
            .join("");

    reportWindow.document.open();
    reportWindow.document.write(`<!doctype html>
      <html lang="uk">
        <head>
          <meta charset="utf-8" />
          <title>Freelance Flow — фінансовий звіт</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              background: #ffffff;
              color: #111827;
              font-family: Arial, sans-serif;
              font-size: 12px;
            }
            main { width: 100%; max-width: 980px; margin: 0 auto; padding: 36px; }
            header { margin-bottom: 24px; }
            .eyebrow { color: #64748b; font-size: 11px; letter-spacing: 1.5px; }
            h1 { margin: 6px 0; font-size: 26px; }
            .meta { color: #64748b; }
            .metrics {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              margin-bottom: 26px;
            }
            .metric { border: 1px solid #dbe2ea; border-radius: 7px; padding: 13px; }
            .metric span { display: block; color: #64748b; margin-bottom: 5px; }
            .metric strong { font-size: 18px; }
            h2 { margin: 0 0 10px; font-size: 17px; }
            table { width: 100%; border-collapse: collapse; }
            th, td {
              border-bottom: 1px solid #e5e7eb;
              padding: 8px 6px;
              text-align: left;
              vertical-align: top;
            }
            th { background: #f1f5f9; font-weight: 700; }
            .empty { color: #64748b; text-align: center; padding: 24px; }
            @page { size: A4 portrait; margin: 12mm; }
            @media print {
              main { max-width: none; padding: 0; }
              .metric, tr { break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <main>
            <header>
              <div class="eyebrow">ФІНАНСОВА CRM</div>
              <h1>Freelance Flow — фінансовий звіт</h1>
              <div class="meta">
                Сформовано ${escapeHtml(formatDate(new Date().toISOString()))} ·
                Валюта звіту: ${escapeHtml(displayCurrency)}
              </div>
            </header>
            <div class="metrics">${metrics}</div>
            <h2>Список проєктів</h2>
            <table>
              <thead>
                <tr>
                  <th>Дата</th><th>Проєкт</th><th>Платформа</th>
                  <th>Gross</th><th>Net</th><th>Статус</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </main>
        </body>
      </html>`);
    reportWindow.document.close();
    reportWindow.focus();
    window.setTimeout(() => reportWindow.print(), 250);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={printReport}>
      <FileText />
      Звіт у PDF
    </Button>
  );
}
