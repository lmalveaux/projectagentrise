create extension if not exists pgcrypto;

create table if not exists public.soa_records (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  prospect_id uuid not null,
  beneficiary_name text not null,
  products_discussed text[] not null default '{}',
  method text not null,
  signed_at timestamptz not null,
  signature_ip text,
  pdf_url text not null,
  retain_until timestamptz not null,
  audit_trail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists soa_records_agent_prospect_idx
  on public.soa_records(agent_id, prospect_id, signed_at desc);

alter table public.soa_records enable row level security;
grant select, insert on public.soa_records to authenticated;

drop policy if exists soa_records_read_own_or_owner on public.soa_records;
create policy soa_records_read_own_or_owner on public.soa_records
  for select to authenticated
  using (
    agent_id = auth.uid()
    or lower(coalesce(auth.jwt() ->> 'email', '')) in ('lisasjazz@gmail.com', '121media.info@gmail.com')
  );

drop policy if exists soa_records_insert_own on public.soa_records;
create policy soa_records_insert_own on public.soa_records
  for insert to authenticated
  with check (agent_id = auth.uid());

create table if not exists public.soa_signing_requests (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  agent_id uuid not null references public.agents(id) on delete cascade,
  prospect_id uuid not null,
  form_data jsonb not null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.soa_signing_requests enable row level security;
grant select, insert on public.soa_signing_requests to authenticated;

drop policy if exists soa_signing_requests_own on public.soa_signing_requests;
create policy soa_signing_requests_own on public.soa_signing_requests
  for select to authenticated using (agent_id = auth.uid());

drop policy if exists soa_signing_requests_insert_own on public.soa_signing_requests;
create policy soa_signing_requests_insert_own on public.soa_signing_requests
  for insert to authenticated with check (agent_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('soa', 'soa', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false;

drop policy if exists soa_storage_read_own_or_owner on storage.objects;
create policy soa_storage_read_own_or_owner on storage.objects
  for select to authenticated
  using (
    bucket_id = 'soa'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or lower(coalesce(auth.jwt() ->> 'email', '')) in ('lisasjazz@gmail.com', '121media.info@gmail.com')
    )
  );

-- Files are written only by the server-side SOA function. Clients receive short-lived signed URLs.
