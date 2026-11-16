import { NextResponse, type NextRequest } from "next/server";

const LAB_HOST = process.env.LAB_HOST || "lab.vtcons.com";
const PORTFOLIO_HOST = process.env.PORTFOLIO_HOST || "william-doan.vtcons.com";

/**
 * One deployment, two subdomains:
 *   william-doan.vtcons.com  → portfolio (/)
 *   lab.vtcons.com           → project hub (/lab/*), served at the root
 * On *.vercel.app and localhost both are reachable at / and /lab.
 */
export function proxy(req: NextRequest) {
  const host = (req.headers.get("host") || "").split(":")[0];
  const { pathname } = req.nextUrl;

  if (host === LAB_HOST || host.startsWith("lab.")) {
    if (pathname.startsWith("/lab") || pathname.startsWith("/api")) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = `/lab${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  if (host === PORTFOLIO_HOST && pathname.startsWith("/lab")) {
    return NextResponse.redirect(`https://${LAB_HOST}${pathname.replace(/^\/lab/, "") || "/"}${req.nextUrl.search}`);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
