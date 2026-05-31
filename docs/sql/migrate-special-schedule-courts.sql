-- Permite limitar un horario especial a pistas concretas.
-- court_ids null significa "todas las pistas" para mantener compatibilidad
-- con los horarios especiales creados antes de esta migracion.

alter table public.saturday_slot_overrides
  add column if not exists court_ids integer[] null;

alter table public.saturday_slot_overrides
  drop constraint if exists saturday_slot_overrides_court_ids_not_empty;

alter table public.saturday_slot_overrides
  add constraint saturday_slot_overrides_court_ids_not_empty
  check (court_ids is null or cardinality(court_ids) > 0);

notify pgrst, 'reload schema';
