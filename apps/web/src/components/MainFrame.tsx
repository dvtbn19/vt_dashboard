"use client";

import { usePathname } from "next/navigation";

/** Lab page width: a readable column; the dashboard is wider and the side-by-side workspace uses the full width. */
export function MainFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const wide = path.endsWith("/workspace");
  const dashboard = path.endsWith("/dashboard");
  const cls = wide
    ? "w-full px-4 pt-6 md:px-6"
    : `mx-auto w-full ${dashboard ? "max-w-[1400px]" : "max-w-[1080px]"} px-4 pt-6 md:px-8 md:pt-10`;
  return <div className={cls}>{children}</div>;
}
