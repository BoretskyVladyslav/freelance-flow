import { NextResponse } from "next/server";
import { normalizeEurRates } from "@/lib/exchange-rates";

const ER_API_URL = "https://open.er-api.com/v6/latest/EUR";
const REVALIDATE_SECONDS = 3600;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get("refresh") === "1";

  try {
    const response = await fetch(ER_API_URL, {
      cache: refresh ? "no-store" : "force-cache",
      next: refresh ? { revalidate: 0 } : { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Exchange rate API failed with status ${response.status}.` },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as unknown;
    const rates = normalizeEurRates(payload as Parameters<typeof normalizeEurRates>[0]);

    return NextResponse.json(rates, {
      headers: {
        "Cache-Control": refresh
          ? "no-store"
          : `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to fetch exchange rates.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
