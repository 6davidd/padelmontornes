-- Fix Supabase Advisor issue: Security Definer View
--
-- Affected views:
--   - public.reservations_public
--   - public.members_public
--   - public.reservation_players_public
--
-- Run this in the Supabase SQL editor, then rerun Security Advisor.
-- The first SELECT lets you inspect the current state before changing it.

select
  n.nspname as schema_name,
  c.relname as view_name,
  pg_get_userbyid(c.relowner) as owner,
  c.reloptions,
  pg_get_viewdef(c.oid, true) as view_definition
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'v'
  and c.relname in (
    'reservations_public',
    'members_public',
    'reservation_players_public'
  )
order by c.relname;

begin;

alter view public.reservations_public
  set (security_invoker = true);

alter view public.members_public
  set (security_invoker = true);

alter view public.reservation_players_public
  set (security_invoker = true);

-- These pages are protected by app authentication, so anonymous clients should
-- not need direct access to these API-exposed views.
revoke all on public.reservations_public from anon;
revoke all on public.members_public from anon;
revoke all on public.reservation_players_public from anon;

grant select on public.reservations_public to authenticated;
grant select on public.members_public to authenticated;
grant select on public.reservation_players_public to authenticated;

commit;

notify pgrst, 'reload schema';

-- Expected after commit:
--   - reloptions includes security_invoker=true for all three views.
--   - anon has no SELECT privilege on these views.
select
  n.nspname as schema_name,
  c.relname as view_name,
  c.reloptions,
  has_table_privilege('anon', c.oid, 'select') as anon_can_select,
  has_table_privilege('authenticated', c.oid, 'select') as authenticated_can_select
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'v'
  and c.relname in (
    'reservations_public',
    'members_public',
    'reservation_players_public'
  )
order by c.relname;
