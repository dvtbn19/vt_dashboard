import type { Metadata } from "next";
import Link from "next/link";
import { signIn } from "../actions";
import { LoginForm } from "@/components/forms";
import { authMode, portfolioHref, supabaseConfig } from "@/lib/config";

export const metadata: Metadata = { title: "Sign in to the lab", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  const mode = authMode();
  const misconfigured = mode === "supabase" && !supabaseConfig();
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        <Link href={portfolioHref()} className="text-[14px] text-muted hover:text-ink">
          William Doan
        </Link>
        <h1 className="mt-4 text-[28px] font-bold tracking-tight">Project Lab</h1>
        <p className="mt-1 text-muted">Private. Sign in to see projects, runs and results.</p>
        {expired && (
          <p role="status" className="mt-5 rounded-lg bg-run/10 px-3 py-2 text-[14.5px] text-run">
            Your session ended. Sign in again to continue.
          </p>
        )}
        {mode === "local" && (
          <p className="mt-5 rounded-lg bg-sunken px-3 py-2 text-[13.5px] text-muted">
            Local development sign-in (LAB_AUTH_MODE=local). Production uses Supabase Auth.
          </p>
        )}
        <div className="mt-6">
          {misconfigured ? (
            <p role="alert" className="text-fail">
              Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
            </p>
          ) : (
            <LoginForm action={signIn} />
          )}
        </div>
      </div>
    </main>
  );
}
