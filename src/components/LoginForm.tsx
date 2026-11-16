"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";

export function LoginForm({ next, labels }: { next: string; labels: { password: string; signIn: string } }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="next" value={next} />
      <label className="text-[15px] font-medium" htmlFor="pw">
        {labels.password}
      </label>
      <input
        id="pw"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        aria-invalid={Boolean(state?.error)}
        aria-describedby={state?.error ? "pw-err" : undefined}
        className="field"
      />
      {state?.error ? (
        <p id="pw-err" className="text-[15px] text-redpen">
          {state.error}
        </p>
      ) : null}
      <button className="btn btn-primary mt-3" disabled={pending}>
        {pending ? "Signing in…" : labels.signIn}
      </button>
    </form>
  );
}
