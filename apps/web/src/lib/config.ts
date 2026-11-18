import "server-only";

export type AuthMode = "local" | "supabase";

export function apiUrl(): string {
  return (process.env.API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
}

export function authMode(): AuthMode {
  return process.env.LAB_AUTH_MODE === "supabase" ? "supabase" : "local";
}

export function supabaseConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

export const LOCAL_TOKEN_COOKIE = "lab_token";

/**
 * Optional absolute base URLs when the portfolio and the lab live on different hosts
 * (e.g. PORTFOLIO_URL=https://william-doan.vtcons.com, LAB_URL=https://lab.vtcons.com).
 * When unset, links stay relative and everything is served from one host (local dev).
 */
function base(name: "PORTFOLIO_URL" | "LAB_URL"): string {
  return (process.env[name] || "").trim().replace(/\/$/, "");
}

export function portfolioHref(path = "/"): string {
  return base("PORTFOLIO_URL") + path;
}

export function labHref(path = "/lab"): string {
  return base("LAB_URL") + path;
}
