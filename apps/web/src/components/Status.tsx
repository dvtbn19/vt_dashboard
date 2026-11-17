import type { RunStatus } from "@/lib/types";

const RUN: Record<string, { label: string; cls: string }> = {
  running: { label: "Running", cls: "text-run" },
  completed: { label: "Completed", cls: "text-accent" },
  failed: { label: "Failed", cls: "text-fail" },
  ready: { label: "Ready", cls: "text-accent" },
  pending_upload: { label: "Awaiting upload", cls: "text-idle" },
};

/** Status is shown as colour + shape + word, never colour alone. */
export function StatusDot({ status, withLabel = true }: { status: RunStatus | string; withLabel?: boolean }) {
  const s = RUN[status] ?? { label: status, cls: "text-idle" };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${s.cls}`}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="shrink-0">
        {status === "failed" ? (
          <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        ) : status === "running" ? (
          <circle cx="5" cy="5" r="4" fill="currentColor" className="motion-safe:animate-pulse" />
        ) : status === "completed" || status === "ready" ? (
          <circle cx="5" cy="5" r="4" fill="currentColor" />
        ) : (
          <circle cx="5" cy="5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        )}
      </svg>
      {withLabel ? s.label : <span className="sr-only">{s.label}</span>}
    </span>
  );
}

export function Chip({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "accent" | "warn" }) {
  const cls =
    tone === "accent"
      ? "bg-accent/12 text-accent"
      : tone === "warn"
        ? "bg-run/12 text-run"
        : "bg-sunken text-muted";
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[12.5px] font-medium ${cls}`}>{children}</span>;
}
