# Narrately Proof in the shared Supabase project

This project will use Narrately's existing Supabase project and Auth users. The migration creates the shared `product_entitlements` access table, Proof-specific `proof_*` tables, a private `proof-files` Storage bucket, and owner-scoped read policies. It does not create or modify `auth.users` or a shared `profiles` table.

## Identity and product access

- The same email/password identity can be used to sign in to each Narrately product that connects to this Supabase Auth project.
- A successful sign-in proves identity only. Each app must check its own `product_entitlements` row before showing paid or free product features.
- Proof's free plan is self-activated from the Proof app. The database policy permits a user to create only their own active Proof free-plan row. Summary and Research access must be granted by their own signup/billing flows; signing into Proof does not grant either one.
- Paid plan changes must be written by a trusted billing/backend process, never directly by the browser. Enforce usage quotas in the API as well as displaying them in the UI.
- This repository can implement Proof's product gate. The Summary and Research codebases must add their own entitlement checks, and the shared public landing page navigation belongs in the main Narrately site.

## Confirmation email setup

The Proof signup flow requests Supabase's signup confirmation email and returns to `/auth/callback`. Password reset requests started from Proof use `/forgot-password`, then return through `/auth/callback` to `/reset-password`. Admin-generated reset emails use the configured Site URL by default, so use Proof's Forgot password link when you need to return to the Proof app. Under **Authentication → URL Configuration → Redirect URLs**, allow the local callback URL and the deployed app callback URL. If confirmation emails are not arriving, configure email delivery in the existing Supabase project's **Authentication → SMTP Settings**. Supabase's built-in sender is restricted and rate limited; use an SMTP provider for real users. Then check the project's **Logs** page with **Auth** selected and check the SMTP provider's delivery/bounce logs. Keep SMTP credentials in Supabase settings, not in this repository.

Keep **Confirm email** enabled under **Authentication → Providers → Email** to require confirmation before password sign-in. Use the registration screen's resend action for an unconfirmed signup. Confirm the Auth email template links to `{{ .ConfirmationURL }}` and uses the configured redirect URL.

## Before applying the migration

1. Confirm that the existing Narrately project is the intended project.
2. Inspect its current schema for any existing `proof_*` objects or conflicting Storage policies.
3. Review `migrations/20261006000000_create_proof_mvp.sql` against the current Narrately profile conventions.
4. Apply through a reviewed Supabase migration workflow. Do not paste secret keys into source files or chat.

The migration has not been applied to Supabase. Local environment templates are in the repository root `.env.example` and `backend/.env.example`. Use the project's publishable key in Next.js. Keep any Supabase secret key exclusively in the backend environment; it bypasses RLS and is needed only for trusted worker operations.

For local email-confirmation links, allow `http://localhost:3000/auth/callback` under the existing project's Auth URL Configuration redirect URLs. Supabase requires the `redirectTo` URL to match an allowed redirect entry; see the [official redirect URL guide](https://supabase.com/docs/guides/auth/redirect-urls).

## Locked product layout

- Auth: existing Narrately Supabase Auth.
- Database: shared Postgres, isolated `proof_*` metadata and a `proof_jobs` table as the first queue.
- Storage: dedicated private `proof-files` bucket.
- Local processing: FastAPI, Ollama, PyMuPDF, python-docx, openpyxl.
- Initial vector index: FAISS CPU on the local worker; Windows installation will use Conda, not pip.
