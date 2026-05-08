# Recuperación de contraseña

El flujo de recuperación usa enlaces propios con `token_hash` y `type=recovery`.
La página `/reset-password` muestra el formulario directamente, pero no consume el
token hasta que la persona pulsa `Guardar contraseña`. Esto evita la pantalla
intermedia y reduce el riesgo de que una vista previa del email gaste el enlace.

## Caducidad del enlace

En proyectos hosted de Supabase, la duración del enlace no se fija desde este
repositorio ni desde `generateLink` enlace por enlace. Debe configurarse en el
dashboard de Supabase:

1. Supabase Dashboard.
2. Authentication.
3. Providers.
4. Email.
5. Email OTP Expiration.
6. Usar `1800` segundos para una caducidad de 30 minutos.

Para desarrollo local con Supabase CLI, el equivalente es:

```toml
[auth.email]
otp_expiry = 1800
```

El email no promete una duración exacta; solo indica que el enlace caduca pasado
un tiempo, porque esa garantía depende de la configuración activa del proyecto
en Supabase.
