"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmedPassword, setConfirmedPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [validRecoverySession, setValidRecoverySession] = useState(false);

  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => {
      setValidRecoverySession(Boolean(data.session));
      setChecking(false);
    });
  }, []);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    if (password !== confirmedPassword) { setError("The passwords do not match."); return; }
    setBusy(true);
    try {
      const { error: updateError } = await createClient().auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage("Your password has been updated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update your password.");
    } finally { setBusy(false); }
  }

  if (checking) return <main className="auth-screen"><div className="auth-card"><p>Checking your reset link…</p></div></main>;

  return <AuthLayout title="Choose a new password" subtitle="Set a password for your existing Narrately account.">
    {!validRecoverySession ? <>
      <p className="auth-error" role="alert">This reset link is invalid or expired. Request a new one to continue.</p>
      <p className="auth-switch"><Link href="/forgot-password">Request another reset link</Link></p>
    </> : message ? <>
      <p className="auth-message" role="status">{message}</p>
      <button className="button auth-submit" onClick={() => { router.replace("/"); router.refresh(); }}>Continue to Narrately Proof</button>
    </> : <form className="auth-form" onSubmit={updatePassword}>
      <label>New password<input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event)=>setPassword(event.target.value)} placeholder="At least 8 characters"/></label>
      <label>Confirm new password<input type="password" autoComplete="new-password" required minLength={8} value={confirmedPassword} onChange={(event)=>setConfirmedPassword(event.target.value)} placeholder="Enter the password again"/></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="button auth-submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
    </form>}
  </AuthLayout>;
}
