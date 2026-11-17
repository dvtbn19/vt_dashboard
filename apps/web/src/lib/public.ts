import "server-only";
import { ApiError, publicApi } from "./api";
import type { PublicProject } from "./types";

/** Public projects for the portfolio. Never throws: the portfolio must render even if the API is down. */
export async function getPublicProjects(): Promise<PublicProject[]> {
  try {
    return await publicApi<PublicProject[]>("/v1/public/projects", { next: { revalidate: 300 }, timeoutMs: 5000 });
  } catch {
    return [];
  }
}

export async function getPublicProject(slug: string): Promise<PublicProject | null> {
  try {
    return await publicApi<PublicProject>(`/v1/public/projects/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 },
      timeoutMs: 5000,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
