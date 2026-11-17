"use client";

export default function LabError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-[560px] py-10">
      <h1 className="text-[24px] font-bold">This page could not load</h1>
      <p className="mt-3 text-muted">Something failed while loading this page. Try again; if it keeps happening, check the web and API logs.</p>
      {error.digest && <p className="hint mt-2">Reference: {error.digest}</p>}
      <button type="button" onClick={reset} className="btn mt-6">
        Try again
      </button>
    </div>
  );
}
