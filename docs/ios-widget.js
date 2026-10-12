// Freelance Flow — Scriptable widget (iOS 17+)
// 1. Install Scriptable.
// 2. Set API_URL to your deployed origin and TOKEN to WIDGET_SECRET_KEY.
// 3. Add a Small or Medium Scriptable widget and pick this script.
// Network waits up to 10 seconds, then the last saved summary is shown.
// With no cache, the widget shows a loading placeholder instead of failing.

const API_URL = "https://YOUR_DOMAIN/api/widget/summary";
const TOKEN = "flow-widget-token-2026";
const CACHE_NAME = "freelance-flow-widget.json";

const ink = Color.dynamic(new Color("#0f172a"), new Color("#f1f5f9"));
const muted = Color.dynamic(new Color("#64748b"), new Color("#94a3b8"));
const card = Color.dynamic(new Color("#ffffff"), new Color("#0f172a"));
const line = Color.dynamic(new Color("#e2e8f0"), new Color("#1e293b"));
const net = Color.dynamic(new Color("#059669"), new Color("#10b981"));
const amber = new Color("#d97706");
const sky = new Color("#0284c7");

function formatAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0,00";
  const [whole, fraction] = amount.toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return grouped + "," + fraction;
}

function cachePath() {
  const files = FileManager.local();
  return files.joinPath(files.documentsDirectory(), CACHE_NAME);
}

function readCache() {
  try {
    const files = FileManager.local();
    const path = cachePath();
    if (!files.fileExists(path)) return null;
    const parsed = JSON.parse(files.readString(path));
    if (!parsed) {
      return null;
    }
    if ((typeof parsed.netUah) !== "number") {
      return null;
    }
    return parsed;
  } catch (error) {
    return null;
  }
}

function writeCache(summary) {
  try {
    FileManager.local().writeString(cachePath(), JSON.stringify(summary));
  } catch (error) {
    // A cache miss still leaves the live payload on screen.
  }
}

function isSummary(value) {
  if (!value) {
    return false;
  }
  if ((typeof value.netUah) !== "number") {
    return false;
  }
  return (typeof value.netEur) === "number";
}

async function loadSummary() {
  const request = new Request(API_URL + "?view=unpaid&token=" + encodeURIComponent(TOKEN));
  request.headers = {
    Accept: "application/json",
    "x-widget-token": TOKEN,
  };
  request.timeoutInterval = 10;
  const payload = await request.loadJSON();
  if (!isSummary(payload)) {
    throw new Error("Widget payload was incomplete.");
  }
  writeCache(payload);
  return payload;
}

function addText(stack, text, size, color, weight) {
  const lineText = stack.addText(text);
  if (weight === "bold") lineText.font = Font.boldSystemFont(size);
  else if (weight === "semibold") lineText.font = Font.semiboldSystemFont(size);
  else lineText.font = Font.mediumSystemFont(size);
  lineText.textColor = color;
  return lineText;
}

function paintHeader(stack, compact, summary, badge, badgeColor) {
  const header = stack.addStack();
  header.layoutHorizontally();
  header.centerAlignContent();

  const brand = addText(header, "⚡️ Freelance Flow", compact ? 11 : 13, ink, "semibold");
  brand.lineLimit = 1;
  header.addSpacer();

  const pill = header.addStack();
  pill.layoutHorizontally();
  pill.centerAlignContent();
  pill.backgroundColor = Color.dynamic(new Color("#f1f5f9"), new Color("#1e293b"));
  pill.cornerRadius = 8;
  pill.setPadding(2, 6, 2, 6);
  const mark = addText(pill, badge, 9, badgeColor, "medium");
  mark.lineLimit = 1;
  if (summary && summary.periodLabel) {
    addText(pill, "  " + summary.periodLabel, 9, muted, "medium").lineLimit = 1;
  }
}

function paintPlaceholder(stack, compact, title, detail) {
  stack.addSpacer(compact ? 8 : 12);
  addText(stack, title, compact ? 14 : 16, ink, "semibold");
  stack.addSpacer(4);
  const note = addText(stack, detail, compact ? 10 : 12, muted, "medium");
  note.lineLimit = compact ? 3 : 2;
}

function paintSummary(stack, compact, summary) {
  const gross = formatAmount(summary.grossUah) + " грн";
  const netUah = formatAmount(summary.netUah) + " грн";
  const netEur = "≈ " + formatAmount(summary.netEur) + " €";
  const active = Number(summary.activeCount) || 0;
  const pending = Number(summary.pendingCount) || 0;

  if (compact) {
    stack.addSpacer(6);
    addText(stack, "Net до отримання", 10, muted, "medium");
    const netLine = addText(stack, netUah, 18, net, "bold");
    netLine.lineLimit = 1;
    netLine.minimumScaleFactor = 0.65;
    addText(stack, netEur, 11, muted, "medium");
    stack.addSpacer();
    addText(stack, "Валовий  " + gross, 10, ink, "medium").lineLimit = 1;
    addText(stack, "Активні  " + String(active + pending), 10, muted, "medium");
    return;
  }

  stack.addSpacer(8);
  const top = stack.addStack();
  top.layoutHorizontally();
  top.topAlignContent();

  const left = top.addStack();
  left.layoutVertically();
  addText(left, "Net до отримання", 11, muted, "medium");
  const netLine = addText(left, netUah, 24, net, "bold");
  netLine.lineLimit = 1;
  netLine.minimumScaleFactor = 0.6;
  addText(left, netEur, 13, muted, "medium");

  top.addSpacer();

  const badges = top.addStack();
  badges.layoutVertically();
  badges.topAlignContent();
  const progress = addText(badges, "В процесі  " + String(active), 11, amber, "semibold");
  progress.lineLimit = 1;
  badges.addSpacer(4);
  const waiting = addText(badges, "Очікується  " + String(pending), 11, sky, "semibold");
  waiting.lineLimit = 1;

  stack.addSpacer();
  const bottom = stack.addStack();
  bottom.layoutHorizontally();
  bottom.centerAlignContent();
  const grossLine = addText(bottom, "Gross  " + gross, 11, ink, "medium");
  grossLine.lineLimit = 1;
  bottom.addSpacer(8);
  const fees =
    "Комісія фірми  " +
    formatAmount(summary.firmFeeUah) +
    "   Податки  " +
    formatAmount(summary.taxesUah);
  const feeLine = addText(bottom, fees, 10, muted, "medium");
  feeLine.lineLimit = 1;
  feeLine.minimumScaleFactor = 0.7;
}

const family = config.widgetFamily || "medium";
const compact = family === "small";

let summary = null;
let badge = "LIVE";
let badgeColor = net;
let placeholder = null;

try {
  summary = await loadSummary();
} catch (error) {
  summary = readCache();
  if (summary) {
    badge = "КЕШ";
    badgeColor = amber;
  } else {
    placeholder = {
      title: "Завантаження…",
      detail: "Немає мережі або сервер ще відповідає. Віджет оновиться сам.",
    };
  }
}

const widget = new ListWidget();
widget.backgroundColor = line;
widget.setPadding(2, 2, 2, 2);

const body = widget.addStack();
body.layoutVertically();
body.backgroundColor = card;
body.cornerRadius = 14;
body.setPadding(compact ? 10 : 12, 12, 10, 12);

paintHeader(body, compact, summary, summary ? badge : "…", summary ? badgeColor : muted);
if (summary) {
  paintSummary(body, compact, summary);
} else {
  paintPlaceholder(body, compact, placeholder.title, placeholder.detail);
}

widget.refreshAfterDate = new Date(Date.now() + (summary ? 15 : 5) * 60 * 1000);

if (config.runsInWidget) {
  Script.setWidget(widget);
} else if (compact) {
  await widget.presentSmall();
} else {
  await widget.presentMedium();
}

Script.complete();
