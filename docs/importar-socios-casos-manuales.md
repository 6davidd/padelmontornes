# Casos manuales para importar socios

## Preparación

- Inicia sesión con un usuario `owner`.
- Abre `/admin/importar-socios`.
- Usa el CSV de ejemplo o crea uno ad hoc según cada caso.

## Casos a comprobar

1. Fila correcta
   - CSV con una fila válida y única.
   - Esperado: preview en estado `Lista`, importación `Creado`, invitación enviada.

2. Email en mayúsculas y con espacios
   - Ejemplo: `  SOCIO.NUEVO@EJEMPLO.COM  `
   - Esperado: preview con email normalizado en minúsculas y la importación crea solo una vez ese email.

3. Nombre en formato caótico
   - Ejemplo: `  MARCOS   vidal molina `
   - Esperado: preview con nombre normalizado `Marcos Vidal Molina`.

4. Email inválido
   - Ejemplo: `correo-invalido`
   - Esperado: preview con estado `Error` y detalle `El email no es válido.`

5. Email duplicado dentro del CSV
   - Dos filas con el mismo email, aunque vengan con mayúsculas/minúsculas distintas.
   - Esperado: ambas filas marcadas como `Duplicado CSV` y no se importan.

6. Email ya existente en sistema
   - Usa un email que ya exista en `members` o en Supabase Auth.
   - Esperado: preview `Duplicado sistema` y no se importa.

7. Fallo en envío de invitación
   - Simulación sencilla: desconfigura temporalmente `RESEND_API_KEY` o `EMAIL_FROM`.
   - Esperado: la importación no completa altas y devuelve error claro de configuración o de envío.

8. Varias filas mixtas
   - CSV con filas válidas, duplicadas y erróneas.
   - Esperado: se crean solo las válidas; las demás quedan como `Duplicado` o `Error` sin abortar el proceso completo.

9. Admin o superadmin intentando entrar sin permiso
   - Inicia sesión con un `admin` o `superadmin`.
   - Esperado: no ven la opción en el panel y no pueden acceder a `/admin/importar-socios` ni usar `/api/admin/import-members`.

10. Owner accediendo correctamente
    - Inicia sesión con un `owner`.
    - Esperado: ve la opción en el panel, puede abrir la página y ejecutar preview/import.
