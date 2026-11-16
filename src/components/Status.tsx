const colors: Record<string, string> = {
  running: "var(--amber)",
  claimed: "var(--amber)",
  pending: "var(--cyan)",
  active: "var(--lime)",
  done: "var(--lime)",
  failed: "var(--rose)",
  cancelled: "var(--dim)",
  paused: "var(--dim)",
  idea: "var(--violet)",
  draft: "var(--dim)",
};

export function StatusPill({ status }: { status: string }) {
  const c = colors[status] ?? "var(--muted)";
  const live = status === "running" || status === "claimed" || status === "active";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line-2 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-muted">
      <span className={`dot ${live ? "dot-pulse" : ""}`} style={{ background: c, color: c }} />
      {status}
    </span>
  );
}

export function VisibilityPill({ isPublic, labels }: { isPublic: boolean; labels: { public: string; private: string } }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${
        isPublic ? "bg-lime/10 text-lime" : "bg-white/5 text-dim"
      }`}
    >
      {isPublic ? labels.public : labels.private}
    </span>
  );
}
