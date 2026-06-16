create extension if not exists pgcrypto;

create table if not exists public.tournament_events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  date date null,
  public_enabled boolean not null default true,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournament_events_slug_not_empty check (btrim(slug) <> ''),
  constraint tournament_events_name_not_empty check (btrim(name) <> ''),
  constraint tournament_events_state_is_object check (jsonb_typeof(state) = 'object')
);

alter table public.tournament_events
  add column if not exists date date null;

alter table public.tournament_events
  add column if not exists public_enabled boolean not null default true;

alter table public.tournament_events
  add column if not exists state jsonb not null default '{}'::jsonb;

alter table public.tournament_events
  add column if not exists created_at timestamptz not null default now();

alter table public.tournament_events
  add column if not exists updated_at timestamptz not null default now();

create index if not exists tournament_events_slug_idx
  on public.tournament_events (slug);

comment on table public.tournament_events is
  'Eventos puntuales de torneo del club. El estado editable vive en JSONB para cuadros y grupos.';

create or replace function public.set_tournament_events_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tournament_events_set_updated_at
  on public.tournament_events;

create trigger tournament_events_set_updated_at
  before update on public.tournament_events
  for each row
  execute function public.set_tournament_events_updated_at();

alter table public.tournament_events enable row level security;

revoke all on table public.tournament_events from anon;
revoke all on table public.tournament_events from authenticated;

grant select on table public.tournament_events to anon;
grant select, insert, update, delete on table public.tournament_events
  to authenticated;

drop policy if exists "Public can read enabled tournament events"
  on public.tournament_events;

create policy "Public can read enabled tournament events"
  on public.tournament_events
  for select
  to anon, authenticated
  using (public_enabled is true);

drop policy if exists "Admins can manage tournament events"
  on public.tournament_events;

create policy "Admins can manage tournament events"
  on public.tournament_events
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
