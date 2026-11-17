const dtf = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Australia/Sydney",
});

export function fmtDate(iso: string | null | undefined): string {
  return iso ? dtf.format(new Date(iso)) : "—";
}

export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "never";
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} d ago`;
  return fmtDate(iso);
}

export function duration(start: string, end: string | null): string {
  if (!end) return "in progress";
  const s = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function num(v: number): string {
  if (Number.isInteger(v)) return v.toLocaleString("en-AU");
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toLocaleString("en-AU", { maximumFractionDigits: 2 });
  if (abs >= 1) return v.toLocaleString("en-AU", { maximumFractionDigits: 3 });
  return v.toPrecision(3);
}
