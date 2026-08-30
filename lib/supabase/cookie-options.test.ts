import { describe, expect, it } from "vitest";
import { mergeAuthCookieOptions } from "@/lib/supabase/cookie-options";

describe("mergeAuthCookieOptions", () => {
  it("forces SameSite=Lax and Secure on HTTPS", () => {
    expect(mergeAuthCookieOptions({ path: "/app" }, true)).toMatchObject({
      path: "/app",
      sameSite: "lax",
      secure: true,
    });
  });

  it("keeps Secure off on HTTP so localhost cookies stick", () => {
    expect(mergeAuthCookieOptions(undefined, false)).toMatchObject({
      path: "/",
      sameSite: "lax",
      secure: false,
    });
  });
});
