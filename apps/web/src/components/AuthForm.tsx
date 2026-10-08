"use client";

import { useActionState } from "react";
import { loginAction, registerAction, type FormState } from "@/lib/actions";

function SubmitButton({ label }: { label: string }) {
  return <button className="btn primary" type="submit" style={{ width: "100%" }}>{label}</button>;
}

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, undefined);
  return (
    <form action={action} className="grid" style={{ gap: 12 }}>
      <div>
        <label className="field" htmlFor="login-email">Email</label>
        <input className="input" id="login-email" name="email" type="email" autoComplete="email" required defaultValue="trader@veylora.dev" />
      </div>
      <div>
        <label className="field" htmlFor="login-password">Password</label>
        <input className="input" id="login-password" name="password" type="password" autoComplete="current-password" required defaultValue="password123" />
      </div>
      {state?.error && <p role="alert" className="neg" style={{ margin: 0, fontSize: 13 }}>{state.error}</p>}
      <div style={{ opacity: pending ? 0.6 : 1 }}><SubmitButton label={pending ? "Signing in…" : "Sign in"} /></div>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(registerAction, undefined);
  return (
    <form action={action} className="grid" style={{ gap: 12 }}>
      <div>
        <label className="field" htmlFor="reg-name">Name</label>
        <input className="input" id="reg-name" name="name" required />
      </div>
      <div>
        <label className="field" htmlFor="reg-email">Email</label>
        <input className="input" id="reg-email" name="email" type="email" required />
      </div>
      <div>
        <label className="field" htmlFor="reg-password">Password</label>
        <input className="input" id="reg-password" name="password" type="password" minLength={8} required />
        <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>At least 8 characters.</p>
      </div>
      {state?.error && <p role="alert" className="neg" style={{ margin: 0, fontSize: 13 }}>{state.error}</p>}
      <div style={{ opacity: pending ? 0.6 : 1 }}><SubmitButton label={pending ? "Creating…" : "Create account"} /></div>
    </form>
  );
}
