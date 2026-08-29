# Freelance Flow

Multi-currency CRM for freelance revenue, dual-layer tax calculation, and payout tracking.

Freelance Flow records project earnings in **EUR, USD, UAH, or PLN**, converts them to a **EUR base**, applies a fixed tax sequence, and shows net payout plus live currency gain/loss. Data stays in the browser (IndexedDB with LocalStorage fallback). No backend database or account is required.

## Core features

- **Dual-layer tax engine** — Spain tax **19%**, then company tax **30%**, with two-decimal rounding after every step (`decimal.js`, `ROUND_HALF_UP`).
- **Locked historical FX** — each transaction stores `exchangeRateAtCreation` (units of EUR per 1 unit of original currency). Historical net never drifts when rates change.
- **Live FX rates** — `/api/exchange-rates` fetches EUR-based rates from [open.er-api.com](https://open.er-api.com), inverts them to `toEur`, caches them, and supports a manual refresh.
- **Offline-first persistence** — IndexedDB via `idb-keyval`, automatic LocalStorage fallback, last-known-rate cache.
- **JSON import / export** — versioned backup envelope with validation (`types/finance.ts`).
- **Executive dashboard** — gross, Spain tax, company tax, net payout, remaining-to-be-paid, and currency gain/loss cards.
- **Weekly analytics** — Recharts bar chart of gross vs net by ISO week.
- **Quick entry** — add or edit a project with live tax preview; ISO week is derived from the date.
- **Filterable ledger** — platform, status, month, and week filters; original amounts; expandable tax breakdown; display-currency totals.

Supported platforms: Freelancehunt, Freelance BG, Direct Client, Other.

## Tax math breakdown

All money math lives in [`lib/tax-calculator.ts`](lib/tax-calculator.ts). UI, charts, and storage call this module; they do not reimplement the sequence.

**Base currency is EUR.** Original amounts stay in the transaction currency. Display currency only converts EUR totals for viewing.

FX rates are **not** rounded to 2 decimals (up to 8 places). Every **money** intermediate is rounded to **2 decimals** before the next step.

### Sequence

Given `grossAmount`, `customFee`, and `exchangeRate` (EUR per 1 original unit):

1. `grossInBase = round(grossAmount × exchangeRate)`
2. `feeInBase = round(customFee × exchangeRate)`
3. `taxableBase = round(grossInBase − feeInBase)`
4. `spainTax = round(taxableBase × 0.19)`
5. `postSpainBase = round(taxableBase − spainTax)`
6. `companyTax = round(postSpainBase × 0.30)`
7. `netPayout = round(postSpainBase − companyTax)`

**Live gain/loss:** the same sequence is rerun with the current live `toEur` rate.  
`currencyGainLoss = currentNetPayoutAtLiveRate − netPayout` (creation-rate net).

### Example

`1000 USD`, fee `50 USD`, creation rate `0.90`:

| Step | Result (EUR) |
| --- | ---: |
| Gross in base | 900.00 |
| Fee in base | 45.00 |
| Taxable base | 855.00 |
| Spain 19% | 162.45 |
| Post-Spain | 692.55 |
| Company 30% | 207.77 |
| Net payout | 484.78 |

If the live USD→EUR rate is `0.95`, live net is `511.71` and gain/loss is `+26.93 EUR`.

## Architecture

```
app/
  page.tsx                      Dashboard route
  api/exchange-rates/route.ts   Cached EUR FX proxy
components/finance/             Dashboard, ledger, quick entry, persistence provider
lib/tax-calculator.ts           Decimal tax sequence (source of truth)
lib/storage.ts                  IndexedDB + LocalStorage + backup JSON
types/finance.ts                Strict unions, transaction, backup envelope
```

Persistence is browser-local and ready to migrate later (Supabase/Prisma). Backup schema version is `1`.

## Getting started

### Requirements

- Node.js 18+ (20+ recommended)
- npm 10+

No `.env` file is required. Exchange rates are fetched server-side from a public API.

### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other scripts

```bash
npm run test        # Vitest (tax rounding + backup validation)
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run build       # Production build
npm start           # Serve the production build
```

### Data backup

Use **Export** / **Import** in the header. Import replaces all current transactions after confirmation. Files are JSON and stay on your machine until you upload them.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 14 (App Router, TypeScript) |
| UI | Tailwind CSS, shadcn/ui, Lucide |
| Charts | Recharts |
| Money math | Decimal.js (`ROUND_HALF_UP`) |
| Persistence | IndexedDB (`idb-keyval`) + LocalStorage fallback |
| FX | open.er-api.com via `app/api/exchange-rates` |
| Tests | Vitest |

## License

Private project unless otherwise stated on the repository.
