import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/widget/summary/route";

vi.mock("@/lib/supabase/admin", () => ({
  getServiceRoleKey: () => {
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
    return key || null;
  },
  createServiceRoleClient: () => ({
    from: () => ({
      select: async () => ({ data: [], error: null }),
    }),
  }),
}));

const ENV_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "WIDGET_SECRET_KEY",
] as const;

describe("widget summary route", () => {
  const previous = new Map<string, string | undefined>();

  function isolateEnv(): void {
    for (const key of ENV_KEYS) {
      if (!previous.has(key)) previous.set(key, process.env[key]);
      delete process.env[key];
    }
  }

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    previous.clear();
    vi.restoreAllMocks();
  });

  it("rejects a request without the widget token", async () => {
    isolateEnv();
    const response = await GET(new Request("http://localhost/api/widget/summary"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("logs a fallback and returns 503 when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    isolateEnv();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await GET(
      new Request("http://localhost/api/widget/summary?token=flow-widget-token-2026"),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Widget data source is not configured.",
    });
    expect(
      error.mock.calls.some((call) => String(call[0]).includes("SUPABASE_SERVICE_ROLE_KEY is missing")),
    ).toBe(true);
  });

  it("returns 200 and a widget summary when the token and service role are configured", async () => {
    isolateEnv();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

    const response = await GET(
      new Request("http://localhost/api/widget/summary?token=flow-widget-token-2026"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(
      ["activeProjects", "grossUah", "netEur", "netUah", "updatedAt"].sort(),
    );
    expect(body.activeProjects).toBe(0);
    expect(body.netUah).toBe(0);
    expect(body.netEur).toBe(0);
    expect(body.grossUah).toBe(0);
    expect(body.updatedAt).toEqual(expect.any(String));
  });
});
