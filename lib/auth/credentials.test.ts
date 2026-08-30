import { describe, expect, it } from "vitest";
import { sanitizeEmail } from "@/lib/auth/credentials";

describe("sanitizeEmail", () => {
  it("trims and lowercases iOS-capitalized addresses", () => {
    expect(sanitizeEmail("  User@Company.COM  ")).toBe("user@company.com");
  });
});
