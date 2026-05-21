-- Preferencias personales de emails por socio.
-- Todas las preferencias nacen activadas para conservar el comportamiento actual.
create table if not exists public.notification_preferences (
  member_user_id uuid primary key references public.members(user_id) on delete cascade,
  booking_created_email boolean not null default true,
  added_to_match_email boolean not null default true,
  match_reminder_email boolean not null default true,
  match_completed_email boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_preferences_member_user_id_idx
  on public.notification_preferences (member_user_id);

create or replace function public.set_notification_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notification_preferences_set_updated_at
  on public.notification_preferences;

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row
  execute function public.set_notification_preferences_updated_at();

alter table public.notification_preferences enable row level security;

revoke all on table public.notification_preferences from anon;
revoke all on table public.notification_preferences from authenticated;
grant select, insert, update on table public.notification_preferences to authenticated;

drop policy if exists "Members can read their notification preferences"
  on public.notification_preferences;

create policy "Members can read their notification preferences"
  on public.notification_preferences
  for select
  to authenticated
  using (member_user_id = auth.uid());

drop policy if exists "Members can create their notification preferences"
  on public.notification_preferences;

create policy "Members can create their notification preferences"
  on public.notification_preferences
  for insert
  to authenticated
  with check (member_user_id = auth.uid());

drop policy if exists "Members can update their notification preferences"
  on public.notification_preferences;

create policy "Members can update their notification preferences"
  on public.notification_preferences
  for update
  to authenticated
  using (member_user_id = auth.uid())
  with check (member_user_id = auth.uid());

comment on table public.notification_preferences is
  'Preferencias personales de emails de reservas y partidas por socio.';

notify pgrst, 'reload schema';
