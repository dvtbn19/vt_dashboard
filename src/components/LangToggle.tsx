"use client";

import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { setLang } from "@/app/actions";

/** Segmented EN | VI switch. */
export function LangToggle({ lang }: { lang: "en" | "vi" }) {
  const path = usePathname();
  const [pending, start] = useTransition();
  return (
    <div
      className="inline-flex rounded-[9px] border border-rule bg-raised p-0.5 text-[13px] font-semibold"
      aria-busy={pending}
      role="group"
      aria-label="Language / Ngôn ngữ"
    >
      {(["en", "vi"] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={lang === l}
          onClick={() => start(() => setLang(l, path))}
          className={`min-h-[32px] min-w-[38px] rounded-[7px] px-2 transition-colors ${
            lang === l ? "bg-sheet text-ink shadow-[0_1px_2px_rgb(0_0_0/0.15)]" : "text-pencil hover:text-ink"
          }`}
        >
          {l === "en" ? "EN" : "VI"}
        </button>
      ))}
    </div>
  );
}
