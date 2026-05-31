-- Migracion segura para convertir horarios de sabado en horarios especiales.
-- Mantiene la tabla public.saturday_slot_overrides para no romper datos ni codigo
-- desplegado, pero permite guardar cualquier fecha concreta.

alter table public.saturday_slot_overrides
  drop constraint if exists saturday_slot_overrides_date_is_saturday;

alter table public.saturday_slot_overrides
  add column if not exists updated_at timestamptz not null default now();

alter table public.saturday_slot_overrides
  add column if not exists court_ids integer[] null;

alter table public.saturday_slot_overrides
  drop constraint if exists saturday_slot_overrides_court_ids_not_empty;

alter table public.saturday_slot_overrides
  add constraint saturday_slot_overrides_court_ids_not_empty
  check (court_ids is null or cardinality(court_ids) > 0);

comment on table public.saturday_slot_overrides is
  'Horarios especiales por fecha concreta. El nombre de tabla se mantiene por compatibilidad con la primera version de horarios de sabado.';

create or replace function public.set_saturday_slot_overrides_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists saturday_slot_overrides_set_updated_at
  on public.saturday_slot_overrides;

create trigger saturday_slot_overrides_set_updated_at
  before update on public.saturday_slot_overrides
  for each row
  execute function public.set_saturday_slot_overrides_updated_at();

drop policy if exists "Authenticated members can read saturday slots"
  on public.saturday_slot_overrides;
drop policy if exists "Authenticated members can read special schedules"
  on public.saturday_slot_overrides;

create policy "Authenticated members can read special schedules"
  on public.saturday_slot_overrides
  for select
  to authenticated
  using (true);

drop policy if exists "Admins can manage saturday slots"
  on public.saturday_slot_overrides;
drop policy if exists "Admins can manage special schedules"
  on public.saturday_slot_overrides;

create policy "Admins can manage special schedules"
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
