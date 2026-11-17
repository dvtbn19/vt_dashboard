export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="animate-pulse space-y-4">
      <div className="h-8 w-56 rounded-lg bg-sunken" />
      <div className="h-4 w-80 max-w-full rounded bg-sunken" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-sunken" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-sunken" />
    </div>
  );
}
