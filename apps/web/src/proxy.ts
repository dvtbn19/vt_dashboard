import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Lab routes need a session. This is only a convenience redirect — every API call is still
 * authorised by FastAPI, which verifies the token itself.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/lab/login") return NextResponse.next();

  const toLogin = () => {
    const url = request.nextUrl.clone();
    url.pathname = "/lab/login";
    url.search = "";
    return NextResponse.redirect(url);
  };

  if (process.env.LAB_AUTH_MODE !== "supabase") {
    return request.cookies.get("lab_token") ? NextResponse.next() : toLogin();
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supaUrl || !anonKey) return toLogin();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supaUrl, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  // Refreshes an expired access token using the refresh token cookie.
  const { data } = await supabase.auth.getUser();
  if (!data.user) return toLogin();
  return response;
}

export const config = { matcher: ["/lab/:path*"] };
