"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const { error: authError } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw authError;
      router.replace("/"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not sign in."); }
    finally { setBusy(false); }
  }

  return <AuthLayout title="Welcome back" subtitle="Sign in with your Narrately account to continue.">
    <form className="auth-form" onSubmit={signIn}>
      <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event)=>setEmail(event.target.value)} placeholder="you@company.com"/></label>
      <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event)=>setPassword(event.target.value)} placeholder="Your password"/></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="button auth-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
    <p className="auth-switch"><Link href="/forgot-password">Forgot your password?</Link></p>
    <p className="auth-switch">New to Narrately? <Link href="/register">Create an account</Link></p>
  </AuthLayout>;
}
