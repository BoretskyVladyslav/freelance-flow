import { afterEach, describe, expect, it, vi } from "vitest";

const { createClientMock, fromMock, selectMock } = vi.hoisted(() => {
  const selectMock = vi.fn(async () => ({ data: [], error: null }));
  const fromMock = vi.fn(() => ({ select: selectMock }));
  const createClientMock = vi.fn(() => ({ from: fromMock }));
  return { createClientMock, fromMock, selectMock };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

import { GET } from "@/app/api/widget/summary/route";

const ENV_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "WIDGET_SECRET_KEY",
] as const;

function jwt(role: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ role })).toString("base64url");
  return `${header}.${payload}.signature`;
}

describe("widget summary route", () => {
  const previous = new Map<string, string | undefined>();

  function isolateEnv(): void {
    for (const key of ENV_KEYS) {
      if (!previous.has(key)) previous.set(key, process.env[key]);
      delete process.env[key];
    }
  }

  let errorSpy: ReturnType<typeof vi.spyOn> | null = null;

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    previous.clear();
    errorSpy?.mockRestore();
    errorSpy = null;
    createClientMock.mockClear();
    fromMock.mockClear();
    selectMock.mockClear();
  });

  it("rejects a request without the widget token", async () => {
    isolateEnv();
    const response = await GET(new Request("http://localhost/api/widget/summary"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("logs a fallback and returns 503 when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    isolateEnv();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await GET(
      new Request("http://localhost/api/widget/summary?token=flow-widget-token-2026"),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Widget data source is not configured.",
    });
    expect(
      errorSpy.mock.calls.some((call) => String(call[0]).includes("SUPABASE_SERVICE_ROLE_KEY is missing")),
    ).toBe(true);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("refuses to query when the configured key is an anon credential", async () => {
    isolateEnv();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = jwt("anon");
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(
      new Request("http://localhost/api/widget/summary?token=flow-widget-token-2026"),
    );

    expect(response.status).toBe(503);
    expect(createClientMock).not.toHaveBeenCalled();
    expect(
      errorSpy.mock.calls.some((call) => String(call[0]).includes("anon credential")),
    ).toBe(true);
  });

  it("returns 200 and reads projects with the service role client", async () => {
    isolateEnv();
    process.env.SUPABASE_SERVICE_ROLE_KEY = jwt("service_role");
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

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(createClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      serviceKey,
      expect.objectContaining({
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: { Authorization: `Bearer ${serviceKey}` },
        },
      }),
    );
    expect(fromMock).toHaveBeenCalledWith("projects");
    expect(selectMock).toHaveBeenCalledWith("*");
  });
});
