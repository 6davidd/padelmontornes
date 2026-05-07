-- Registra de forma idempotente los avisos enviados cuando las 3 pistas
-- estan completas para el mismo dia y horario.
create extension if not exists pgcrypto;

create table if not exists public.all_courts_full_alerts (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  date date not null,
  slot_start time not null,
  slot_end time not null,
  message_text text not null,
  recipients text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  resend_email_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.all_courts_full_alerts
  drop constraint if exists all_courts_full_alerts_unique_slot;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'all_courts_full_alerts'
      and column_name = 'is_test'
  ) then
    execute 'delete from public.all_courts_full_alerts where is_test is true';
  end if;
end $$;

drop index if exists public.all_courts_full_alerts_unique_real_slot_idx;

alter table public.all_courts_full_alerts
  drop column if exists is_test;

create unique index if not exists all_courts_full_alerts_unique_slot_idx
  on public.all_courts_full_alerts (date, slot_start, slot_end);

create index if not exists all_courts_full_alerts_token_idx
  on public.all_courts_full_alerts (token);

create index if not exists all_courts_full_alerts_date_slot_idx
  on public.all_courts_full_alerts (date, slot_start, slot_end);

alter table public.all_courts_full_alerts enable row level security;

revoke all on table public.all_courts_full_alerts from anon;
revoke all on table public.all_courts_full_alerts from authenticated;

comment on table public.all_courts_full_alerts is
  'Avisos enviados cuando las 3 pistas estan completas en un mismo horario.';
