import { NextResponse, type NextRequest } from "next/server";
import { apiUrl } from "@/lib/config";
import { getAccessToken } from "@/lib/session";

/** Asks the API for a short-lived signed URL (after it checks ownership) and redirects to it. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getAccessToken();
  if (!token) return NextResponse.redirect(new URL("/lab/login", request.url));
  const res = await fetch(`${apiUrl()}/v1/artifacts/${encodeURIComponent(id)}/download`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 401) return NextResponse.redirect(new URL("/lab/login?expired=1", request.url));
  if (!res.ok) return new NextResponse("File not available", { status: res.status === 404 ? 404 : 502 });
  const { url } = (await res.json()) as { url: string };
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
}
