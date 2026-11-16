"use client";

import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { setLang } from "@/app/actions";

export function LangToggle({ lang }: { lang: "en" | "vi" }) {
  const path = usePathname();
  const [pending, start] = useTransition();
  return (
    <div className="inline-flex text-[14px] font-medium" aria-busy={pending} role="group" aria-label="Language / Ngôn ngữ">
      {(["en", "vi"] as const).map((l, i) => (
        <span key={l} className="inline-flex items-center">
          {i ? <span aria-hidden className="mx-1 text-rule">/</span> : null}
          <button
            type="button"
            lang={l}
            aria-pressed={lang === l}
            onClick={() => start(() => setLang(l, path))}
            className={`min-h-[36px] px-1 ${lang === l ? "text-ink underline decoration-2 underline-offset-4" : "text-pencil hover:text-ink"}`}
          >
            {l === "en" ? "EN" : "VI"}
          </button>
        </span>
      ))}
    </div>
  );
}
