create table if not exists public.soa_carrier_forms (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  carrier_name text not null,
  file_url text not null,
  uploaded_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.soa_carrier_forms enable row level security;
grant select, insert, update, delete on public.soa_carrier_forms to authenticated;

drop policy if exists soa_carrier_forms_own on public.soa_carrier_forms;
create policy soa_carrier_forms_own on public.soa_carrier_forms
  for all to authenticated using (agent_id = auth.uid()) with check (agent_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('soa-forms', 'soa-forms', false)
on conflict (id) do update set public = false;

drop policy if exists soa_forms_read_own on storage.objects;
create policy soa_forms_read_own on storage.objects for select to authenticated
using (bucket_id = 'soa-forms' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists soa_forms_insert_own on storage.objects;
create policy soa_forms_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'soa-forms' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists soa_forms_update_own on storage.objects;
create policy soa_forms_update_own on storage.objects for update to authenticated
using (bucket_id = 'soa-forms' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'soa-forms' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists soa_forms_delete_own on storage.objects;
create policy soa_forms_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'soa-forms' and (storage.foldername(name))[1] = auth.uid()::text);
