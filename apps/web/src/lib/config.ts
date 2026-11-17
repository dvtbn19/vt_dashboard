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
