"use client";

import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { setLang } from "@/app/actions";

export function LangToggle({ lang }: { lang: "en" | "vi" }) {
  const path = usePathname();
  const [pending, start] = useTransition();
  return (
    <div
      className="inline-flex rounded-full border border-line-2 p-0.5 font-mono text-[11px]"
      aria-busy={pending}
      role="group"
      aria-label="Language"
    >
      {(["en", "vi"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => start(() => setLang(l, path))}
          className={`rounded-full px-2.5 py-1 uppercase transition ${
            lang === l ? "bg-fg text-ink" : "text-muted hover:text-fg"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
