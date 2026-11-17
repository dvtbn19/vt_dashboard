import "server-only";
import { ApiError, ApiUnavailable } from "./api";

export type Problem = { kind: "unavailable" | "forbidden" | "notfound" | "error"; detail: string };
export type Attempt<T> = { ok: true; data: T } | { ok: false; problem: Problem };

function isRedirect(err: unknown) {
  const digest = (err as { digest?: unknown })?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR"));
}

/** Run an API call and turn failures into a renderable problem (redirects still propagate). */
export async function attempt<T>(fn: () => Promise<T>): Promise<Attempt<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (isRedirect(err)) throw err;
    if (err instanceof ApiUnavailable) return { ok: false, problem: { kind: "unavailable", detail: err.message } };
    if (err instanceof ApiError) {
      const kind = err.status === 403 ? "forbidden" : err.status === 404 ? "notfound" : "error";
      return { ok: false, problem: { kind, detail: err.detail } };
    }
    throw err;
  }
}
