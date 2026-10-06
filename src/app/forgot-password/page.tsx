"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/proof";
      const { error: resetError } = await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}${basePath}/auth/callback?next=${encodeURIComponent(`${basePath}/reset-password`)}`,
      });
      if (resetError) throw resetError;
      setMessage("If an account exists for that email, a password reset link will be sent. Check your inbox and spam folder.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not request a password reset.");
    } finally { setBusy(false); }
  }

  return <AuthLayout title="Reset your password" subtitle="We’ll email you a secure link to choose a new password.">
    <form className="auth-form" onSubmit={sendReset}>
      <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event)=>setEmail(event.target.value)} placeholder="you@company.com"/></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {message && <p className="auth-message" role="status">{message}</p>}
      <button className="button auth-submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
    </form>
    <p className="auth-switch"><Link href="/login">Back to sign in</Link></p>
  </AuthLayout>;
}
