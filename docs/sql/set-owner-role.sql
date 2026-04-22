-- 1) Si la columna members.role usa un enum de PostgreSQL,
--    añade el nuevo valor owner de forma segura.
DO $$
DECLARE
  column_data_type text;
  enum_schema text;
  enum_name text;
BEGIN
  SELECT data_type, udt_schema, udt_name
  INTO column_data_type, enum_schema, enum_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'members'
    AND column_name = 'role';

  IF column_data_type = 'USER-DEFINED' THEN
    EXECUTE format(
      'ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L',
      enum_schema,
      enum_name,
      'owner'
    );
  END IF;
END $$;

-- 2) Asigna el rol owner al usuario que quieras.
--    Sustituye el email por el tuyo antes de ejecutarlo.
UPDATE public.members
SET role = 'owner'
WHERE email = 'tu-email@ejemplo.com';
