import { describe, expect, it } from "vitest";
import { isValidEmail, sanitizeEmail } from "@/lib/auth/credentials";

describe("sanitizeEmail", () => {
  it("trims and lowercases iOS-capitalized addresses", () => {
    expect(sanitizeEmail("  User@Company.COM  ")).toBe("user@company.com");
  });
});

describe("isValidEmail", () => {
  it("accepts a trimmed address", () => {
    expect(isValidEmail("  user@company.com  ")).toBe(true);
  });

  it("rejects empty or malformed values", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("user@")).toBe(false);
  });
});
