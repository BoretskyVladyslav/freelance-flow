import type { CookieOptions } from "@supabase/ssr";

export function isHttpsProtocol(protocol: string): boolean {
  return protocol === "https:";
}

export function authCookieOptions(secure: boolean): CookieOptions {
  return {
    path: "/",
    sameSite: "lax",
    secure,
  };
}

export function mergeAuthCookieOptions(
  options: CookieOptions | undefined,
  secure: boolean,
): CookieOptions {
  return {
    ...authCookieOptions(secure),
    ...options,
    path: options?.path ?? "/",
    sameSite: options?.sameSite ?? "lax",
    secure: options?.secure ?? secure,
  };
}
