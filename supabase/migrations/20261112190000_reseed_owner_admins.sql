-- Reconcile the two Agent Rise owner accounts with their current auth.users IDs.
insert into public.admins (user_id, email)
select id, lower(email)
from auth.users
where lower(email) in ('lisasjazz@gmail.com', '121media.info@gmail.com')
on conflict (user_id) do update
set email = excluded.email;

grant select on public.admins to authenticated;

insert into public.account_entitlements (user_id, tier, status, source)
select user_id, 'owner', 'active', 'admin'
from public.admins
where lower(email) in ('lisasjazz@gmail.com', '121media.info@gmail.com')
on conflict (user_id) do update
set tier = 'owner',
    status = 'active',
    source = 'admin',
    updated_at = now();
