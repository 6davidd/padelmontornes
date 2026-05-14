create extension if not exists pgcrypto;

create table if not exists public.saturday_slot_overrides (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  slot_start time not null,
  slot_end time not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint saturday_slot_overrides_unique_date_start unique (date, slot_start),
  constraint saturday_slot_overrides_date_is_saturday
    check (extract(isodow from date) = 6),
  constraint saturday_slot_overrides_duration_90_minutes
    check (slot_end = slot_start + interval '90 minutes')
);

create index if not exists saturday_slot_overrides_date_idx
  on public.saturday_slot_overrides (date, slot_start);

alter table public.saturday_slot_overrides enable row level security;

revoke all on table public.saturday_slot_overrides from anon;
grant select, insert, update, delete on table public.saturday_slot_overrides
  to authenticated;

drop policy if exists "Authenticated members can read saturday slots"
  on public.saturday_slot_overrides;

create policy "Authenticated members can read saturday slots"
  on public.saturday_slot_overrides
  for select
  to authenticated
  using (true);

drop policy if exists "Admins can manage saturday slots"
  on public.saturday_slot_overrides;

create policy "Admins can manage saturday slots"
  on public.saturday_slot_overrides
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.members m
      where m.user_id = auth.uid()
        and m.is_active is true
        and m.role in ('admin', 'superadmin', 'owner')
    )
  )
  with check (
    exists (
      select 1
      from public.members m
      where m.user_id = auth.uid()
        and m.is_active is true
        and m.role in ('admin', 'superadmin', 'owner')
    )
  );

notify pgrst, 'reload schema';
