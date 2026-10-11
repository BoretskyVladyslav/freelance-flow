// Freelance Flow — Scriptable widget (iOS 17+, iPhone 15 Pro)
// 1. Install Scriptable.
// 2. Set API_URL to your deployed origin and TOKEN to WIDGET_SECRET_KEY.
// 3. Add a Small or Medium Scriptable widget on the Home Screen and pick this script.

const API_URL = "https://YOUR_DOMAIN/api/widget/summary";
const TOKEN = "flow-widget-token-2026";

function formatAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0,00";
  const [whole, fraction] = amount.toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped},${fraction}`;
}

function addLabel(widget, text, size, color) {
  const line = widget.addText(text);
  line.font = Font.mediumSystemFont(size);
  line.textColor = new Color(color);
  return line;
}

async function loadSummary() {
  const request = new Request(`${API_URL}?token=${encodeURIComponent(TOKEN)}`);
  request.headers = {
    Accept: "application/json",
    "x-widget-token": TOKEN,
  };
  request.timeoutInterval = 12;
  return request.loadJSON();
}

const family = config.widgetFamily || "medium";
const compact = family === "small";
const summary = await loadSummary();

const widget = new ListWidget();
widget.setPadding(compact ? 12 : 14, 14, 12, 14);
widget.backgroundColor = new Color("#0B1220");

const header = widget.addStack();
header.layoutHorizontally();
header.centerAlignContent();

const dot = header.addText("●");
dot.font = Font.mediumSystemFont(8);
dot.textColor = new Color("#10B981");
header.addSpacer(6);

const brand = header.addText("Freelance Flow");
brand.font = Font.semiboldSystemFont(compact ? 12 : 13);
brand.textColor = new Color("#E2E8F0");
brand.lineLimit = 1;
header.addSpacer();

const live = header.addText("LIVE");
live.font = Font.mediumSystemFont(9);
live.textColor = new Color("#10B981");

widget.addSpacer(compact ? 6 : 10);
addLabel(widget, "Net до виплати", compact ? 10 : 11, "#94A3B8");

const netUah = widget.addText(`${formatAmount(summary.netUah)} грн`);
netUah.font = Font.boldSystemFont(compact ? 18 : 24);
netUah.textColor = new Color("#10B981");
netUah.lineLimit = 1;
netUah.minimumScaleFactor = 0.7;

const netEur = widget.addText(`${formatAmount(summary.netEur)} €`);
netEur.font = Font.mediumSystemFont(compact ? 12 : 14);
netEur.textColor = new Color("#CBD5E1");

widget.addSpacer();

if (compact) {
  addLabel(widget, `Активні: ${summary.activeProjects ?? 0}`, 10, "#94A3B8");
  addLabel(widget, `Валовий: ${formatAmount(summary.grossUah)} грн`, 10, "#94A3B8");
} else {
  const bottom = widget.addStack();
  bottom.layoutHorizontally();
  bottom.centerAlignContent();

  const active = bottom.addText(`Активні проєкти  ${summary.activeProjects ?? 0}`);
  active.font = Font.mediumSystemFont(11);
  active.textColor = new Color("#94A3B8");
  bottom.addSpacer();

  const gross = bottom.addText(`Валовий  ${formatAmount(summary.grossUah)} грн`);
  gross.font = Font.mediumSystemFont(11);
  gross.textColor = new Color("#E2E8F0");
}

if (config.runsInWidget) {
  Script.setWidget(widget);
} else if (compact) {
  await widget.presentSmall();
} else {
  await widget.presentMedium();
}

Script.complete();
