import { NextResponse } from "next/server";
import { fetchStripeAwareRates, sanitizeSpread } from "@/lib/exchange-rates";

const REVALIDATE_SECONDS = 3600;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get("refresh") === "1";
  const spreadPercent = sanitizeSpread(searchParams.get("spread") ?? undefined);

  try {
    const rates = await fetchStripeAwareRates({
      secretKey: process.env.STRIPE_SECRET_KEY,
      spreadPercent,
      cache: refresh ? "fresh" : "cached",
    });

    return NextResponse.json(rates, {
      headers: {
        "Cache-Control": refresh
          ? "no-store"
          : `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch exchange rates.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
