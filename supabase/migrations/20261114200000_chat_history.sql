create table if not exists public.chat_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_history_user_created_at_idx
  on public.chat_history (user_id, created_at desc);

alter table public.chat_history enable row level security;
grant select, insert on public.chat_history to authenticated;

drop policy if exists chat_history_read_own on public.chat_history;
create policy chat_history_read_own on public.chat_history
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists chat_history_insert_own on public.chat_history;
create policy chat_history_insert_own on public.chat_history
  for insert to authenticated
  with check (user_id = auth.uid());
