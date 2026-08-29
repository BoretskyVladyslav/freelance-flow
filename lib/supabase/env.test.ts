import { describe, expect, it } from "vitest";
import { normalizeSupabaseUrl } from "@/lib/supabase/env";

describe("normalizeSupabaseUrl", () => {
  it("strips trailing slashes and whitespace", () => {
    expect(normalizeSupabaseUrl(" https://xyhwmcarslogvxshibut.supabase.co/ ")).toBe(
      "https://xyhwmcarslogvxshibut.supabase.co",
    );
  });
});
