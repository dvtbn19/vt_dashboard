import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="wrap flex h-16 items-center justify-between gap-4">
        <Link href="/" className="font-bold tracking-tight">
          William Doan
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-[15px]">
          <Link href="/#work" className="hidden rounded-lg px-3 py-2 text-muted hover:text-ink sm:inline-block">
            Work
          </Link>
          <Link href="/projects" className="rounded-lg px-3 py-2 text-muted hover:text-ink">
            Projects
          </Link>
          <Link href="/#contact" className="hidden rounded-lg px-3 py-2 text-muted hover:text-ink sm:inline-block">
            Contact
          </Link>
          <Link href="/lab" className="rounded-lg px-3 py-2 text-muted hover:text-ink">
            Lab
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="wrap flex flex-col gap-2 py-8 text-[14px] text-muted sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} Van Thang (William) Doan</p>
        <p>Built with Next.js and FastAPI. Results in the Lab are published by my own scripts and agents.</p>
      </div>
    </footer>
  );
}
