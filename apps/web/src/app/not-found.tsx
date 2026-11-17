import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap py-24">
      <h1 className="text-[28px] font-bold">This page does not exist</h1>
      <p className="mt-3 text-muted">It may have been unpublished, or the link is mistyped.</p>
      <Link href="/" className="btn mt-6">
        Go to the homepage
      </Link>
    </div>
  );
}
