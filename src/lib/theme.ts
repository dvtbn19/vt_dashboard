import { cookies } from "next/headers";

export type Theme = "dark" | "light";

/** Dark is the default; the owner can switch to light and it is remembered. */
export async function getTheme(): Promise<Theme> {
  return (await cookies()).get("theme")?.value === "light" ? "light" : "dark";
}
