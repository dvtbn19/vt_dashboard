"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

function fit(el: HTMLTextAreaElement) {
  if (!el.clientWidth) return; // hidden: measure later
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight + 2}px`;
}

/** A textarea that grows with its content (no inner scrollbar while typing). */
export function AutoTextarea({
  value,
  onChange,
  className = "",
  minRows = 2,
  ...rest
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
  value: string;
  onChange: (v: string) => void;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) fit(el);
  }, [value]);
  // Re-fit when the width changes, including when a hidden panel (phone tabs) becomes visible.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let width = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== width) {
        width = el.clientWidth;
        fit(el);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`field resize-none overflow-hidden leading-relaxed ${className}`}
      {...rest}
    />
  );
}
