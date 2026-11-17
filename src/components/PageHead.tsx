import Link from "next/link";
import { IconBack } from "./Icons";

/** Page title row: optional back link, title, one-line description, actions on the right. */
export function PageHead({
  title,
  desc,
  back,
  actions,
  children,
}: {
  title: React.ReactNode;
  desc?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 md:mb-8">
      {back ? (
        <Link href={back.href} className="-ml-1 inline-flex min-h-[36px] items-center gap-1 self-start text-[14px] font-medium text-pencil hover:text-ink">
          <IconBack size={18} />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] sm:text-[32px]">{title}</h1>
          {desc ? <p className="mt-1.5 max-w-[64ch] text-[15px] text-pencil">{desc}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

export function SectionHead({ title, href, linkLabel, id }: { title: string; href?: string; linkLabel?: string; id?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="text-[17px] font-semibold">
        {title}
      </h2>
      {href ? (
        <Link href={href} className="inline-flex min-h-[36px] items-center text-[14px] font-medium text-signal hover:underline">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="mb-6 rounded-[12px] border border-warn/40 bg-warn/10 px-4 py-3 text-[14.5px]">
      {children}
    </p>
  );
}
