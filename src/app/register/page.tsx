"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { createClient } from "@/lib/supabase/client";

function getConfirmationRedirectUrl() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/proof";
  return `${window.location.origin}${basePath}/auth/callback?next=${encodeURIComponent(`${basePath}/`)}`;
}

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
        options: { emailRedirectTo: getConfirmationRedirectUrl() },
      });
      if (authError) throw authError;
      if (data.session) { router.replace("/"); router.refresh(); }
      else {
        setConfirmationPending(true);
        setMessage("Email confirmation verifies your address; it does not grant a subscription or product access. If you are creating a new account, check your inbox for the confirmation link. If you already have an account, sign in or reset your password.");
      }
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "Could not create the account.";
      setError(/email_address_not_authorized/i.test(detail)
        ? "Email delivery is not configured for this address. Please contact support or try again later."
        : detail);
    }
    finally { setBusy(false); }
  }

  async function resendConfirmation() {
    setError(""); setBusy(true);
    const { error: resendError } = await createClient().auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: getConfirmationRedirectUrl() },
    });
    if (resendError) setError(resendError.message);
    else setMessage("If your account still needs email confirmation, a new link will be sent. The link returns you to Narrately Proof.");
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
