// Freelance Flow — Scriptable widget (iOS 17+, iPhone 15 Pro)
// 1. Install Scriptable.
// 2. Set API_URL to your deployed origin and TOKEN to WIDGET_SECRET_KEY.
// 3. Add a Small or Medium Scriptable widget on the Home Screen and pick this script.
// A slow network waits up to 12 seconds, then shows the last saved summary.
// If nothing has been saved yet, the widget shows a loading placeholder instead of failing.

const API_URL = "https://YOUR_DOMAIN/api/widget/summary";
const TOKEN = "flow-widget-token-2026";
const CACHE_NAME = "freelance-flow-widget.json";

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
    if (!parsed || typeof parsed.netUah !== "number") return null;
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
  return Boolean(
    value &&
      typeof value.netUah === "number" &&
      typeof value.netEur === "number" &&
      typeof value.grossUah === "number",
  );
}

async function loadSummary() {
  const request = new Request(`${API_URL}?token=${encodeURIComponent(TOKEN)}`);
  request.headers = {
    Accept: "application/json",
    "x-widget-token": TOKEN,
  };
  request.timeoutInterval = 12;
  const payload = await request.loadJSON();
  if (!isSummary(payload)) {
    throw new Error("Widget payload was incomplete.");
  }
  writeCache(payload);
  return payload;
}

function paintHeader(widget, compact, badge, badgeColor) {
  const header = widget.addStack();
  header.layoutHorizontally();
  header.centerAlignContent();

  const dot = header.addText("●");
  dot.font = Font.mediumSystemFont(8);
  dot.textColor = new Color(badgeColor);
  header.addSpacer(6);

  const brand = header.addText("Freelance Flow");
  brand.font = Font.semiboldSystemFont(compact ? 12 : 13);
  brand.textColor = new Color("#E2E8F0");
  brand.lineLimit = 1;
  header.addSpacer();

  const live = header.addText(badge);
  live.font = Font.mediumSystemFont(9);
  live.textColor = new Color(badgeColor);
}

function paintPlaceholder(widget, compact, title, detail) {
  widget.addSpacer(compact ? 8 : 12);
  addLabel(widget, title, compact ? 13 : 15, "#E2E8F0");
  widget.addSpacer(6);
  const note = addLabel(widget, detail, compact ? 10 : 11, "#94A3B8");
  note.lineLimit = compact ? 3 : 2;
}

function paintSummary(widget, compact, summary) {
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
}

const family = config.widgetFamily || "medium";
const compact = family === "small";

let summary = null;
let badge = "LIVE";
let badgeColor = "#10B981";
let placeholder = null;

try {
  summary = await loadSummary();
} catch (error) {
  summary = readCache();
  if (summary) {
    badge = "КЕШ";
    badgeColor = "#F59E0B";
  } else {
    placeholder = {
      title: "Завантаження…",
      detail: "Немає мережі або сервер ще відповідає. Віджет оновиться сам.",
    };
  }
}

const widget = new ListWidget();
widget.setPadding(compact ? 12 : 14, 14, 12, 14);
widget.backgroundColor = new Color("#0B1220");
widget.refreshAfterDate = new Date(Date.now() + (summary ? 15 : 5) * 60 * 1000);

paintHeader(widget, compact, summary ? badge : "…", summary ? badgeColor : "#94A3B8");
if (summary) {
  paintSummary(widget, compact, summary);
} else {
  paintPlaceholder(widget, compact, placeholder.title, placeholder.detail);
}

if (config.runsInWidget) {
  Script.setWidget(widget);
} else if (compact) {
  await widget.presentSmall();
} else {
  await widget.presentMedium();
}

Script.complete();
