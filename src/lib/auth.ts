import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "vt_session";
const SESSION_DAYS = 30;

function secret() {
  return process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD || "";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function makeSessionToken() {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  return `${exp}.${sign(String(exp))}`;
}

export function verifySessionToken(token: string | undefined | null) {
  if (!token || !secret()) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(exp));
}

export function checkPassword(pw: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(pw, expected);
}

export async function isAdmin() {
  const c = await cookies();
  return verifySessionToken(c.get(SESSION_COOKIE)?.value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 86400,
};

/** Bots authenticate with `Authorization: Bearer <LAB_API_KEY>` or `x-lab-key`. The owner's session cookie also works. */
export function isAuthorizedRequest(req: Request) {
  const keys = (process.env.LAB_API_KEY || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const header = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || req.headers.get("x-lab-key") || "";
  if (header && keys.some((k) => safeEqual(header, k))) return true;
  const cookie = req.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return verifySessionToken(cookie ? decodeURIComponent(cookie) : null);
}
