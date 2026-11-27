"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { pinDashboardRun, publishDashboard } from "@/app/lab/workspace-actions";
import { fmtDate } from "@/lib/format";

type RunOption = { id: string; name: string; finished_at: string | null; started_at: string };

/** Which run the dashboard shows, and pinning it so the Dashboard button opens it by default. */
export function DashboardSource({
  projectId,
  runs,
  current,
  pinned,
  pinSupported,
  isPublic,
  publicUrl,
}: {
  projectId: string;
  runs: RunOption[];
  current: string;
  pinned: string | null;
  pinSupported: boolean;
  isPublic: boolean;
  publicUrl: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isPinned = pinned === current;

  const choose = (id: string) => {
    const q = new URLSearchParams(sp.toString());
    q.delete("view");
    if (id === pinned) q.delete("run");
    else q.set("run", id);
    const s = q.toString();
    router.push(s ? `${pathname}?${s}` : pathname);
  };
  const pin = () =>
    start(async () => {
      setError(null);
      const res = await pinDashboardRun(projectId, current);
      if (!res.ok) return setError(res.error);
      router.replace(pathname);
      router.refresh();
    });

  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const published = isPublic && isPinned;
  const publish = (on: boolean) =>
    start(async () => {
      setError(null);
      const res = await publishDashboard(projectId, current, on);
      if (!res.ok) return setError(res.error);
      setConfirming(false);
      router.replace(pathname);
      router.refresh();
    });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy; the link is " + publicUrl);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-[13.5px] text-muted">
        <span className="hidden sm:inline">Source</span>
        <select
          value={current}
          onChange={(e) => choose(e.target.value)}
          className="field !min-h-10 max-w-[260px] !py-1.5 text-[14px] text-ink"
          aria-label="Run shown on the dashboard"
        >
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id === pinned ? "📌 " : ""}
              {r.name} · {fmtDate(r.finished_at ?? r.started_at)}
            </option>
          ))}
        </select>
      </label>
      {isPinned ? (
        <span className="text-[13.5px] text-muted" title="The Dashboard button opens this run">
          Pinned
        </span>
      ) : (
        <button
          type="button"
          onClick={pin}
          disabled={pending || !pinSupported}
          className="btn btn-quiet !min-h-10 !px-3 text-[14px]"
          title={pinSupported ? "Open this run whenever the Dashboard button is pressed" : "Apply database migration 0006 to pin a run"}
        >
          {pending ? "Pinning…" : "Pin to dashboard"}
        </button>
      )}
      {!pinSupported && !isPinned && <span className="hint">Pinning needs migration 0006.</span>}
      {pinSupported &&
        (published ? (
          <span className="flex flex-wrap items-center gap-2">
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-accent/12 px-3 text-[14px] font-semibold text-accent">
              <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
              Public
            </a>
            <button type="button" onClick={copy} className="btn btn-quiet !min-h-10 !px-3 text-[14px]">
              {copied ? "Copied" : "Copy link"}
            </button>
            <button type="button" onClick={() => publish(false)} disabled={pending} className="btn btn-quiet !min-h-10 !px-3 text-[14px]">
              Unpublish
            </button>
          </span>
        ) : confirming ? (
          <span role="group" aria-label="Confirm publishing" className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13.5px]">
            <span>Anyone with the link can see this run&apos;s charts, tables and text.</span>
            <button type="button" onClick={() => publish(true)} disabled={pending} className="btn !min-h-9 !px-3 text-[14px]">
              {pending ? "Publishing…" : "Publish"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="text-muted hover:text-ink">
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="btn !min-h-10 !px-4 text-[14px]"
            title="Make this run's dashboard readable by anyone with the link (it also pins the run)"
          >
            Publish
          </button>
        ))}
      {error && (
        <span role="alert" className="text-[13.5px] text-fail">
          {error}
        </span>
      )}
    </div>
  );
}
