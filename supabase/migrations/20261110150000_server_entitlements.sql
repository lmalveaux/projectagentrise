-- Server-authoritative subscription entitlements for Pro features.
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
drop policy if exists admins_read_self on public.admins;
create policy admins_read_self on public.admins
  for select to authenticated
  using (user_id = auth.uid());

insert into public.admins (user_id, email)
select id, email from auth.users
where lower(email) in ('lisasjazz@gmail.com', '121media.info@gmail.com')
on conflict (user_id) do update set email = excluded.email;

create table if not exists public.account_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'trial' check (tier in ('trial', 'pilot', 'pro', 'pro-plus', 'agency', 'owner')),
  status text not null default 'inactive' check (status in ('inactive', 'trialing', 'active', 'past_due', 'canceled')),
  current_period_end timestamptz,
  source text,
  updated_at timestamptz not null default now()
);

alter table public.account_entitlements enable row level security;
drop policy if exists account_entitlements_read_own on public.account_entitlements;
create policy account_entitlements_read_own on public.account_entitlements
  for select to authenticated
  using (user_id = auth.uid());

revoke all on public.account_entitlements from anon, authenticated;
grant select on public.account_entitlements to authenticated;

insert into public.account_entitlements (user_id, tier, status, source)
select user_id, 'owner', 'active', 'admin'
from public.admins
on conflict (user_id) do update
set tier = 'owner', status = 'active', source = 'admin', updated_at = now();

create or replace function public.has_pro_feature(requested_feature text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() is not null
    and requested_feature in ('jit-carriers', 'book-of-business', 'gpt-voice', 'agency', 'phone', 'medicare-minute-production')
    and (
      exists (select 1 from public.admins where user_id = auth.uid())
      or exists (
        select 1
        from public.account_entitlements
        where user_id = auth.uid()
          and status = 'active'
          and tier in ('pro', 'pro-plus', 'agency', 'owner')
          and (current_period_end is null or current_period_end > now())
      )
    );
$$;

create or replace function public.get_account_entitlements()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'tier', coalesce(
      (select 'owner' from public.admins where user_id = auth.uid()),
      (select tier from public.account_entitlements where user_id = auth.uid()),
      'trial'
    ),
    'status', coalesce(
      (select 'active' from public.admins where user_id = auth.uid()),
      (select status from public.account_entitlements where user_id = auth.uid()),
      'inactive'
    ),
    'proAccess', public.has_pro_feature('jit-carriers')
  );
$$;

revoke all on function public.has_pro_feature(text) from public, anon;
revoke all on function public.get_account_entitlements() from public, anon;
grant execute on function public.has_pro_feature(text) to authenticated;
grant execute on function public.get_account_entitlements() to authenticated;

