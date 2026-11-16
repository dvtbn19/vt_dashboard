import { NextResponse } from "next/server";
import { hasDb } from "./db";
import { isAuthorizedRequest } from "./auth";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Returns an error response if the request may not write, otherwise null. */
export function guard(req: Request) {
  if (!isAuthorizedRequest(req)) return err("Unauthorized — send Authorization: Bearer <LAB_API_KEY>", 401);
  if (!hasDb) return err("Database not configured (DATABASE_URL missing)", 503);
  return null;
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

export function handle(fn: () => Promise<Response>) {
  return fn().catch((e: unknown) => err(e instanceof Error ? e.message : String(e), 500));
}
