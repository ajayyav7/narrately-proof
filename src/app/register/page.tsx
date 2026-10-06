"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    try {
      const { data, error: authError } = await createClient().auth.signUp({
        email: email.trim(), password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/` },
      });
      if (authError) throw authError;
      if (data.session) { router.replace("/"); router.refresh(); }
      else { setConfirmationPending(true); setMessage(`If ${email.trim()} is eligible, Supabase will send a confirmation link. Open it to finish creating your account.`); }
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "Could not create the account.";
      setError(/email_address_not_authorized/i.test(detail)
        ? "Supabase's default email sender can only deliver to project team addresses. Configure custom SMTP in Supabase before sending confirmation emails to other people."
        : detail);
    }
    finally { setBusy(false); }
  }

  async function resendConfirmation() {
    setError(""); setBusy(true);
    const { error: resendError } = await createClient().auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/` } });
    if (resendError) setError(resendError.message);
    else setMessage(`If ${email.trim()} has an unconfirmed account, a new confirmation link will be sent.`);
    setBusy(false);
  }

  return <AuthLayout title="Create your Narrately account" subtitle="Use the same account across Narrately products.">
    <form className="auth-form" onSubmit={signUp}>
      <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event)=>setEmail(event.target.value)} placeholder="you@company.com"/></label>
      <label>Password<input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event)=>setPassword(event.target.value)} placeholder="At least 8 characters"/></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {message && <p className="auth-message" role="status">{message}</p>}
      {confirmationPending && <button type="button" className="auth-switch" onClick={resendConfirmation} disabled={busy}>Resend confirmation email</button>}
      <button className="button auth-submit" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
    </form>
    <p className="auth-switch">Already have a Narrately account? <Link href="/login">Sign in</Link></p>
  </AuthLayout>;
}
