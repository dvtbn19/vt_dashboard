import "server-only";
import { cookies } from "next/headers";
import { authMode, LOCAL_TOKEN_COOKIE } from "./config";
import { supabaseServer } from "./supabase";

/** The signed-in user's access token, or null. The API verifies it; the web app never trusts it. */
export async function getAccessToken(): Promise<string | null> {
  if (authMode() === "local") {
    return (await cookies()).get(LOCAL_TOKEN_COOKIE)?.value ?? null;
  }
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
