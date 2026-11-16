"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";

export function LoginForm({ next, labels }: { next: string; labels: { password: string; signIn: string } }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label className="label" htmlFor="pw">
        {labels.password}
      </label>
      <input id="pw" name="password" type="password" autoComplete="current-password" required className="input" />
      {state?.error ? <p className="text-sm text-rose">{state.error}</p> : null}
      <button className="btn btn-lime mt-2 justify-center" disabled={pending}>
        {pending ? "…" : labels.signIn}
      </button>
    </form>
  );
}
