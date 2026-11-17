import Link from "next/link";
import type { Problem } from "@/lib/attempt";

const COPY: Record<Problem["kind"], { title: string; body: string }> = {
  unavailable: {
    title: "The lab API is not responding",
    body: "The web app could not reach the API. Check that the API service is running and that API_URL points to it.",
  },
  forbidden: {
    title: "You do not have access to this",
    body: "Your account is signed in but is not allowed here. The owner can add your e-mail to LAB_ALLOWED_EMAILS on the API.",
  },
  notfound: {
    title: "Not found",
    body: "It does not exist, or it belongs to another account.",
  },
  error: { title: "This could not load", body: "The API returned an error." },
};

export function ProblemState({ problem }: { problem: Problem }) {
  const c = COPY[problem.kind];
  return (
    <div className="max-w-[600px] py-8">
      <h1 className="text-[24px] font-bold">{c.title}</h1>
      <p className="mt-3 text-muted">{c.body}</p>
      <p className="hint mt-2 break-words">Details: {problem.detail}</p>
      <Link href="/lab" className="btn btn-quiet mt-6">
        Back to overview
      </Link>
    </div>
  );
}
