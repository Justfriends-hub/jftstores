create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  session_id text,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  role_tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_push_subs_user on public.push_subscriptions(user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant insert on public.push_subscriptions to anon;
grant all on public.push_subscriptions to service_role;

alter table public.push_subscriptions enable row level security;

create policy "Users view own push subs"
  on public.push_subscriptions for select
  using (auth.uid() is not null and user_id = auth.uid());

create policy "Anyone can register a push sub"
  on public.push_subscriptions for insert
  with check (
    (auth.uid() is not null and user_id = auth.uid())
    or (auth.uid() is null and user_id is null)
  );

create policy "Users update own push subs"
  on public.push_subscriptions for update
  using (auth.uid() is not null and user_id = auth.uid());

create policy "Users delete own push subs"
  on public.push_subscriptions for delete
  using (auth.uid() is not null and user_id = auth.uid());

create policy "Admins manage all push subs"
  on public.push_subscriptions for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create trigger update_push_subs_updated_at
  before update on public.push_subscriptions
  for each row execute function public.update_updated_at_column();