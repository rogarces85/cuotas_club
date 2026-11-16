---
author: Rodrigo Garces
branch: main
status: in-progress
---
# M1 — Socios (CRUD, búsqueda, categorías)

## Intent

Dar al sistema su primer módulo real: administrar el padrón de socios del club.
Hoy el shell muestra la identidad del club pero ningún dato; M1 entrega alta,
edición, búsqueda y baja lógica de socios, sobre la tabla `socio` ya migrada.

Vale la pena porque es el cimiento de todo lo que sigue: cuotas (M2), pagos
(M3) y morosidad (M4) referencian al socio. Sin este CRUD no hay padrón que
cobrar ni deudor que listar.

## Scope

**Adentro:**

- CRUD de socios sobre la tabla `socio` existente (sin migración nueva):
  - `GET /api/socios` — listado con búsqueda por RUT o nombre, filtro por
    estado y por `activo`, paginación.
  - `GET /api/socios/:id` — ficha de un socio.
  - `POST /api/socios` — alta (valida RUT normalizado, nombre, año, sexo,
    estado, email, teléfono).
  - `PATCH /api/socios/:id` — edición de los mismos campos.
  - `DELETE /api/socios/:id` — baja lógica: `activo = 0` (nunca se borra
    el registro; el padrón histórico debe conservarse).
- Autenticación del módulo: `requireSession` protege `/api/socios/*`.
  Sin sesión válida → 401. (Hoy las rutas de negocio están abiertas.)
- Frontend: página "Socios" con tabla (RUT, nombre, año, sexo, estado,
  activo), buscador, y formulario de alta/edición (React Hook Form + Zod,
  la convención del proyecto).
- Navegación del shell: "Socios" pasa a ser una sección real (no un `href="#"`).

**Afuera (explícito):**

- Modelo de roles por operación (`requireRole` para escritura). La gestión de
  usuarios y roles es un módulo propio (Must, sección 4.1). M1 solo exige
  sesión válida; el control fino de quién es tesorero llega con ese módulo.
- Importación de los 54 socios reales (M5, PC de casa).
- Categorías de cuota (`nivel_cuota`): los socios no las cargan; el monto por
  tipo es M2. El `estado` del socio (ACTIVO / MEMBRESIA / BECADO) sí se edita.
- Historial de pagos del socio (ficha enriquecida): eso es M3/M4.

## Checklist

- [ ] T1 — `actualizarSocioSchema` + query de listado en `shared/validators.ts`; `npm run typecheck -w shared` en 0.
- [ ] T2 — middleware `requireSession` en la API; `GET /api/socios` sin sesión devuelve 401 (observado por curl).
- [ ] T3 — rutas CRUD `/api/socios`; alta y listado probados contra la base real (observado por curl).
- [ ] T4 — página "Socios" con tabla, buscador y formulario; `npm run build -w web` OK.
- [ ] T5 — E2E: crear un socio de prueba por la UI/API, verlo en la lista, editarlo y darlo de baja; evidencia capturada.
- [ ] T6 — typecheck + build de los tres workspaces en 0; commit en `main`.

## Evidence

- **T1** — `actualizarSocioSchema` + `listarSociosQuerySchema` en `shared/validators.ts`.
  `npm run typecheck -w shared` → 0 errores.
- **T2** — `requireSession` en `api/src/middleware/auth.ts`. `GET /api/socios` sin
  sesión → **401** (observado por `Invoke-WebRequest` contra la API viva).
- **T3** — rutas CRUD en `api/src/socios/routes.ts` + repo en `repo.ts`, montadas en
  `app.ts`. Contra la base real: alta 201, duplicado 409, búsqueda por RUT y por
  nombre (total=1), edición 200, RUT inválido 400, baja lógica 200 (activo=0),
  segunda baja 404. Evidencia de salida completa registrada.
- **T4** — `SociosPage` + `SocioForm` + `lib/api.ts` + `QueryClientProvider` en
  `main.tsx`. `npm run build -w web` → 174→222 módulos, 0 errores.
- **T5** — E2E navegador real (Chrome/CDP, script `api/scripts/e2e-socios-ui.mjs`):
  clic en "Socios", contador, botón "Nuevo socio", tabla con fila (RUT formateado
  `12.755.663-6`, nombre, año, estado, acciones) y estado vacío. `E2E_SOCIOS_UI_OK`.
  Los socios de prueba se limpiaron; la BD quedó con 0 socios.
- **T6** — `npm run typecheck` (3 workspaces) 0 errores; `npm run build` OK.
  Pendiente de commit (ver Next).

## Next

Commit en `main`. El ciclo ASDD cerró con: spec + plan + analyze + revisión
adversarial tier 2 (3 refutadores). Los findings reales (mass-assignment de
`activo`, falta de suite de tests, evidencia no re-ejecutable) se corrigieron:
`npm test` corre 21 tests (validadores + gate de sesión) y
`api/scripts/verify-socios.mjs` es la verificación CRUD re-ejecutable (9/9).
