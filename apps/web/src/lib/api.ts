import "server-only";
import { redirect } from "next/navigation";
import { apiUrl } from "./config";
import { getAccessToken } from "./session";

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    public body?: unknown,
  ) {
    super(`API ${status}: ${detail}`);
  }
}

export class ApiUnavailable extends Error {}

async function parseError(res: Response): Promise<ApiError> {
  let detail = res.statusText;
  let body: unknown;
  try {
    body = await res.json();
    const d = (body as { detail?: unknown }).detail;
    if (typeof d === "string") detail = d;
    else if (Array.isArray(d)) detail = d.map((x: { msg: string }) => x.msg).join("; ");
    else if (d && typeof (d as { message?: unknown }).message === "string") detail = (d as { message: string }).message;
  } catch {
    /* not JSON */
  }
  return new ApiError(res.status, detail, body);
}

type Init = RequestInit & { token?: string | null; timeoutMs?: number };

async function send(path: string, init: Init = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  try {
    const { token: _token, timeoutMs = 15000, ...rest } = init;
    void _token;
    const caching: RequestInit = init.next ? {} : { cache: "no-store" };
    return await fetch(apiUrl() + path, { ...caching, ...rest, headers, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    throw new ApiUnavailable(`Cannot reach the API at ${apiUrl()}: ${(err as Error).message}`);
  }
}

/**
 * Authenticated call on behalf of the signed-in user.
 * 401 → back to the login page (session missing or expired). Other errors are thrown as ApiError.
 */
export async function api<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const token = await getAccessToken();
  if (!token) redirect("/lab/login");
  const res = await send(path, { ...init, token });
  if (res.status === 401) redirect("/lab/login?expired=1");
  if (!res.ok) throw await parseError(res);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Unauthenticated call (public portfolio data, local login). */
export async function publicApi<T>(path: string, init: Init = {}): Promise<T> {
  const res = await send(path, init);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}
