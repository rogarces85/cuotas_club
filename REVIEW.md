# REVIEW.md — qué juzga una revisión en este repo

## Qué fallo se ve aquí (las clases que de verdad duelen)

- **Un monto que no es entero en CLP.** `float`/decimal en cuotas, pagos o
  egresos viola la constitución (principio 3).
- **Una ruta de negocio sin `requireSession`.** `/api/*` fuera de `/api/auth/*`
  que responda sin sesión es un agujero de autorización (principio 7).
- **Un RUT sin normalizar** (con puntos/guion) o duplicado (principio 4).
- **Una migración aplicada sin leer su SQL** (principio 5).
- **Un secreto o clave en el diff.** Solo `api/.env.example` puede llevar el
  nombre de la variable, nunca el valor (principio 9).
- **Un comprobante servido como estático abierto** (principio 8).

## Rutas a saltar

- `node_modules/`, `dist/`, `web/dist/` (generado).
- `api/drizzle/meta/` (snapshots generados por drizzle-kit; revisar el SQL,
  no el meta).
- Fixtures y datos de prueba bajo `*.test.*` / `*.spec.*`.

## Tope de nits

3 nits por revisión. El resto se descartan.

## Rutas que siempre requieren persona

- `api/src/middleware/auth.ts` y cualquier cambio de autorización.
- Migraciones (`api/drizzle/*.sql`) y cambios de esquema en `shared/src/schema/`.
- Manejo de secretos y `.env`.

Estas rutas son tier 2 en `rsc risk`; la revisión adversarial y la aprobación
humana son obligatorias, no opcionales.

## El resumen empieza con un conteo

Toda revisión abre con: `"N findings: X blocker, Y should-fix, Z nit"`, antes de
cualquier otra cosa.
