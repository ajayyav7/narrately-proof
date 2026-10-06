-- Narrately Proof MVP schema for the existing Narrately Supabase project.
-- Auth identity is auth.users; this migration does not create users/profiles tables.

-- Product access is separate from identity. A shared login alone never grants access.
create table if not exists public.product_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_key text not null check (product_key in ('summary', 'research', 'proof')),
  plan_key text not null check (plan_key in ('free', 'basic', 'pro', 'team')),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled', 'revoked')),
  granted_by text not null default 'self_service' check (granted_by in ('self_service', 'admin', 'billing')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_key)
);
alter table public.product_entitlements enable row level security;
drop policy if exists "product_entitlements_read_own" on public.product_entitlements;
create policy "product_entitlements_read_own" on public.product_entitlements
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "product_entitlements_start_proof_free" on public.product_entitlements;
create policy "product_entitlements_start_proof_free" on public.product_entitlements
  for insert to authenticated with check (
    user_id = (select auth.uid()) and product_key = 'proof' and plan_key = 'free'
    and status = 'active' and granted_by = 'self_service'
  );
grant select, insert on public.product_entitlements to authenticated;
grant all privileges on public.product_entitlements to service_role;

create table if not exists public.proof_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'complete', 'failed')),
  support_rate integer check (support_rate between 0 and 100),
  claim_count integer not null default 0 check (claim_count >= 0),
  supported_count integer not null default 0 check (supported_count >= 0),
  partial_count integer not null default 0 check (partial_count >= 0),
  unsupported_count integer not null default 0 check (unsupported_count >= 0),
  contradicted_count integer not null default 0 check (contradicted_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table if not exists public.proof_sources (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  content_type text not null,
  byte_size bigint not null check (byte_size > 0),
  storage_path text not null unique,
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'complete', 'failed')),
  created_at timestamptz not null default now(),
  unique (id, report_id),
  foreign key (report_id, owner_id)
    references public.proof_reports(id, owner_id) on delete cascade
);

create table if not exists public.proof_claims (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  claim_text text not null,
  report_location text,
  status text not null default 'unsupported'
    check (status in ('supported', 'partially_supported', 'unsupported', 'contradicted')),
  explanation text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, report_id),
  foreign key (report_id, owner_id)
    references public.proof_reports(id, owner_id) on delete cascade
);

create table if not exists public.proof_evidence (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null,
  report_id uuid not null,
  source_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  excerpt text not null,
  source_location text,
  match_score real check (match_score between 0 and 1),
  created_at timestamptz not null default now(),
  foreign key (source_id, report_id)
    references public.proof_sources(id, report_id) on delete cascade,
  foreign key (claim_id, report_id)
    references public.proof_claims(id, report_id) on delete cascade,
  foreign key (report_id, owner_id)
    references public.proof_reports(id, owner_id) on delete cascade
);

create table if not exists public.proof_jobs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'complete', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (report_id, owner_id)
    references public.proof_reports(id, owner_id) on delete cascade
);

create index if not exists proof_reports_owner_created_idx
  on public.proof_reports (owner_id, created_at desc);
create index if not exists proof_sources_report_idx on public.proof_sources (report_id);
create index if not exists proof_claims_report_order_idx on public.proof_claims (report_id, sort_order);
create index if not exists proof_evidence_claim_idx on public.proof_evidence (claim_id);
create index if not exists proof_jobs_queue_idx on public.proof_jobs (status, available_at, created_at);

alter table public.proof_reports enable row level security;
alter table public.proof_sources enable row level security;
alter table public.proof_claims enable row level security;
alter table public.proof_evidence enable row level security;
alter table public.proof_jobs enable row level security;

drop policy if exists "proof_reports_read_own" on public.proof_reports;
create policy "proof_reports_read_own" on public.proof_reports
  for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "proof_sources_read_own" on public.proof_sources;
create policy "proof_sources_read_own" on public.proof_sources
  for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "proof_claims_read_own" on public.proof_claims;
create policy "proof_claims_read_own" on public.proof_claims
  for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "proof_evidence_read_own" on public.proof_evidence;
create policy "proof_evidence_read_own" on public.proof_evidence
  for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "proof_jobs_read_own" on public.proof_jobs;
create policy "proof_jobs_read_own" on public.proof_jobs
  for select to authenticated using (owner_id = (select auth.uid()));

grant select on public.proof_reports, public.proof_sources, public.proof_claims,
  public.proof_evidence, public.proof_jobs to authenticated;
grant all privileges on public.proof_reports, public.proof_sources, public.proof_claims,
  public.proof_evidence, public.proof_jobs to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proof-files',
  'proof-files',
  false,
  26214400,
  array['application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do nothing;

drop policy if exists "proof_storage_read_own" on storage.objects;
create policy "proof_storage_read_own" on storage.objects
  for select to authenticated using (
    bucket_id = 'proof-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
drop policy if exists "proof_storage_insert_own" on storage.objects;
create policy "proof_storage_insert_own" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'proof-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
drop policy if exists "proof_storage_update_own" on storage.objects;
create policy "proof_storage_update_own" on storage.objects
  for update to authenticated using (
    bucket_id = 'proof-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  ) with check (
    bucket_id = 'proof-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
drop policy if exists "proof_storage_delete_own" on storage.objects;
create policy "proof_storage_delete_own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'proof-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
