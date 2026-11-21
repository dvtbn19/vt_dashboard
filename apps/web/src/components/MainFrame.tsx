"use client";

import { usePathname } from "next/navigation";

/** Lab page width: a readable column, except the side-by-side workspace which uses the full width. */
export function MainFrame({ children }: { children: React.ReactNode }) {
  const wide = usePathname().endsWith("/workspace");
  return (
    <div className={wide ? "w-full px-4 pt-6 md:px-6" : "mx-auto w-full max-w-[1080px] px-4 pt-6 md:px-8 md:pt-10"}>{children}</div>
  );
}
