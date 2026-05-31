# Club Padel Montornes

Aplicacion de reservas y gestion del Club Padel Montornes.

## Flujo seguro de trabajo

Regla de oro: `main` representa produccion. Para cambios grandes, trabaja siempre en una rama aparte y publica primero un deploy de prueba.

Vercel crea deploys de preview para ramas que no son la rama de produccion. Si la rama de produccion es `main`, cualquier rama como `feature/home-dashboard` debe servir para probar sin cambiar la web publica. Documentacion oficial: https://vercel.com/docs/git

## 1. Empezar un cambio nuevo

Antes de tocar codigo, mira que hay en el repo:

```bash
git status --short --branch
```

Si estas en `main`, actualiza y crea una rama:

```bash
git switch main
git pull
git switch -c feature/nombre-del-cambio
```

Ejemplo:

```bash
git switch -c feature/home-dashboard
```

Si `git status` muestra cambios pendientes que no son de esta tarea, no los mezcles. Commitelos aparte, guardalos con `git stash`, o termina esa tarea antes de empezar.

## 2. Probar en local

Arranca la app:

```bash
npm run dev
```

Abre:

```text
http://localhost:3000
```

## 3. Probar en movil en tiempo real

Arranca Next escuchando en la red local:

```bash
npm run dev -- -H 0.0.0.0 -p 3000
```

En Windows, busca la IP local:

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object IPAddress,InterfaceAlias
```

En el movil, conectado a la misma Wi-Fi, abre:

```text
http://TU-IP-LOCAL:3000
```

Ejemplo:

```text
http://192.168.1.151:3000
```

Si Windows pregunta por firewall o permisos de Node, permite el acceso en red privada.

## 4. Validar antes de subir

Antes de crear un deploy de prueba:

```bash
npm run lint
npm run build
```

No publiques a `main` si falla alguno.

## 5. Crear deploy de prueba en Vercel

Guarda los cambios en Git:

```bash
git add .
git commit -m "Describe el cambio"
```

Sube la rama:

```bash
git push -u origin feature/nombre-del-cambio
```

Vercel generara un Preview Deployment para esa rama. Usa la URL de preview para probar en ordenador y movil sin romper produccion.

Tambien puedes abrir una Pull Request en GitHub contra `main`; Vercel suele adjuntar ahi el preview.

## 6. Checklist antes de produccion

Comprueba en la URL de preview:

- Login y logout.
- Reservar pista.
- Partidas abiertas.
- Mis reservas.
- Panel de administrador, si el cambio toca admin.
- Vista movil real.
- Que `npm run lint` y `npm run build` siguen pasando.

Nota importante: el preview puede usar la misma base de datos de Supabase que produccion si las variables de entorno de Vercel apuntan al mismo proyecto. Para cambios visuales no pasa nada. Para cambios que escriben, migran o borran datos, usa datos de prueba o prepara un entorno de staging antes.

## 7. Publicar en produccion

Cuando el preview este aprobado, fusiona la rama en `main`:

```bash
git switch main
git pull
git merge --no-ff feature/nombre-del-cambio
git push origin main
```

El push a `main` dispara el deploy de produccion en Vercel.

Alternativa recomendada si estas usando GitHub: abre una Pull Request, revisa el preview, y haz merge desde GitHub cuando este listo.

## 8. Despues de publicar

En cuanto Vercel termine el deploy de produccion:

- Abre la web publica.
- Prueba el flujo principal afectado.
- Mira si hay errores en Vercel.

Si algo sale mal, opciones de vuelta:

- Revertir el commit con `git revert`.
- Usar rollback desde el panel de Vercel.

## Resumen corto

```bash
git switch main
git pull
git switch -c feature/mi-cambio
npm run dev -- -H 0.0.0.0 -p 3000
npm run lint
npm run build
git add .
git commit -m "Mi cambio"
git push -u origin feature/mi-cambio
# probar preview de Vercel
git switch main
git pull
git merge --no-ff feature/mi-cambio
git push origin main
```
