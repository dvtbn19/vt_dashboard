"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/lab/actions";

export function Submit({ children, pending: pendingText }: { children: React.ReactNode; pending?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending} aria-busy={pending}>
      {pending ? pendingText ?? "Saving…" : children}
    </button>
  );
}

export function FormError({ state }: { state: FormState }) {
  if (!state?.error) return null;
  return (
    <p role="alert" className="rounded-lg border border-fail/40 bg-fail/8 px-3 py-2 text-[14.5px] text-fail">
      {state.error}
    </p>
  );
}

type Action = (state: FormState, form: FormData) => Promise<FormState>;

export function LoginForm({ action, defaultEmail }: { action: Action; defaultEmail?: string }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <FormError state={state} />
      <div>
        <label className="label" htmlFor="email">
          E-mail
        </label>
        <input className="field" id="email" name="email" type="email" autoComplete="username" required defaultValue={defaultEmail} />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input className="field" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <Submit pending="Signing in…">Sign in</Submit>
    </form>
  );
}

export function TokenReveal({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-accent/50 bg-accent/8 p-4">
      <p className="font-semibold">Copy this token now. It will not be shown again.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <code className="block min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-surface px-3 py-2.5 font-mono text-[13.5px]">
          {token}
        </code>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={async () => {
            await navigator.clipboard.writeText(token);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="hint mt-3">
        Use it as <code className="font-mono">VTCONS_LAB_TOKEN</code> in the environment of the script or agent.
      </p>
    </div>
  );
}

export function ActionForm({
  action,
  children,
  className,
}: {
  action: Action;
  children: (state: FormState) => React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children(state)}
    </form>
  );
}
