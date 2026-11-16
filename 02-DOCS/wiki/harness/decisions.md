# Harness decisions

- Accepted plan `8e168f6277f8ef8b97149e819c6d992c3c955b8f83fa313f5b6c2b23d4689463`.
- Project kind: software.
- SDD: deferred.

## 2026-11-16 — Versión de vitest fijada a 5.x  (feature: m0-base, task: T1)

Contexto — la primera instalación fijó `vitest@^3.0.5` por error. `npm audit` reportó 2 críticas
(prototype pollution → RCE) en `tinypool` y `@vitest/mocker`, que venían de vitest 3.x.

Opciones — (1) `npm audit fix --force`, que el propio npm marcaba como breaking; (2) subir vitest a
la última estable 5.1.0, verificada en el registro.

Decisión — subir `vitest` a `^5.1.0`. Las 2 críticas desaparecieron.

Por qué — la versión 5.x es la vigente y estable; el `--force` de npm resuelve a ciegas y puede
romper otras dependencias.

## 2026-11-16 — Timestamp → datetime en tablas de auth (feature: m0-base, task: T5)

Contexto — la migración inicial fallaba con `ERROR 1067: Invalid default value` en las
columnas `timestamp(3)` de las tablas de Better Auth. Causa raíz: MariaDB 10.4 con
`explicit_defaults_for_timestamp = OFF` aplica reglas antiguas donde solo una columna
`timestamp` puede tener `DEFAULT now()`; combinarlo con otras columnas `timestamp` nullable
genera el error.

Opciones — (1) activar `explicit_defaults_for_timestamp = ON` (cambio global en XAMPP);
(2) usar `datetime` en lugar de `timestamp` en el esquema de auth.

Decisión — usar `datetime` (con `.default(sql`(CURRENT_TIMESTAMP(3))`)`) en las tablas de
auth. El esquema generado por Better Auth se modifica a mano tras generarlo; se documentó en
el encabezado de `auth-schema.ts`.

Por qué — `datetime` no tiene el comportamiento de auto-inicialización de `timestamp`, así
que el DDL es estable sin tocar la configuración global del servidor (que afectaría a todos
los proyectos de XAMPP). Better Auth escribe las fechas desde la app, así que el default de
BD es solo un respaldo.

## 2026-11-16 — Migrator propio en vez de `drizzle-kit migrate` (feature: m0-base, task: T5)

Contexto — `drizzle-kit migrate` fallaba con exit code 1 sin mostrar el error (reporting
roto en esta combinación Windows + drizzle-kit 0.31). El SQL era válido; el problema era
solo de visibilidad del error y de resolución de credenciales `.env`.

Opciones — (1) seguir con `drizzle-kit migrate` y pasar variables por entorno; (2) crear
`api/src/migrate.ts` que usa `drizzle-orm/mysql2/migrator` con el pool de la app.

Decisión — script propio `npm run db:migrate -w api` (tsx + migrator de drizzle-orm). Se
mantiene `drizzle-kit generate` para producir el SQL (que se lee antes de aplicar).

Por qué — el migrator de la app usa el mismo pool ya verificado y reporta el error real. La
regla de MaríaDB 10.4 (leer el SQL antes de aplicar) se mantiene: `generate` produce, se lee,
`db:migrate` aplica.

