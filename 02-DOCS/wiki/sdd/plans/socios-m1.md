---
title: Plan — Administración de socios (M1)
type: sdd-plan
slug: socios-m1
status: draft
spec: socios-m1
created: 2026-11-16
---

# Plan — Administración de socios (M1)

Deriva de la spec aprobada `02-DOCS/wiki/sdd/specs/socios-m1.md` y respeta la
constitución v1.0.0. Este plan es **retrospectivo**: documenta la arquitectura
ya implementada y verificada, que pasa por los gates de ASDD sin reescribirse.

## 0. Global constraints

Valores que todo task debe honrar (verbatim, no parafraseados):

- RUT normalizado: `^\d{7,8}[0-9K]$`, sin puntos ni guion, único (constitución 4).
- Baja lógica: `activo = 0`, nunca `DELETE` físico (constitución 15).
- Sesión obligatoria en rutas de negocio → 401 sin sesión (constitución 7).
- Montos enteros en CLP (constitución 3; no intervienen en M1 pero aplican a `socio`).
- Una sola regla de validación compartida api/web (constitución 2).
- `typecheck` y `build` en cero errores para merge (constitución 10, 11).

## 1. Context & constraints

- Spec `§Acceptance criteria` AC1–AC7; `§What it must respect` (RUT, baja lógica,
  sesión, validación compartida).
- Constitución principios 2, 3, 4, 7, 15.
- Stack fijado (D1): Hono + Drizzle + Better Auth en backend; React + RHF +
  TanStack Query en frontend. El esquema `socio` ya existe y está migrado.

## 2. Architecture

```
web (React)                         api (Hono)
┌──────────────────────┐   /api    ┌──────────────────────────┐
│ Shell (navegación)   │ ────────► │ app.ts (montaje de rutas) │
│  └ SociosPage        │  fetch    │  └ socios/routes.ts       │
│     ├ SocioForm (RHF)│  proxy    │     ├ requireSession (401)│
│     └ lib/api.ts     │           │     └ socios/repo.ts      │
└──────────────────────┘           │           └ drizzle ──► MariaDB
      TanStack Query               └──────────────────────────┘
```

- **web**: `SociosPage` (tabla + búsqueda + filtro + paginación + modal),
  `SocioForm` (RHF + Zod), `lib/api.ts` (cliente fetch con cookie). Estado del
  servidor por TanStack Query; invalidación tras cada mutación.
- **api**: `socios/routes.ts` (Hono, valida con Zod), `middleware/auth.ts`
  (`requireSession`), `socios/repo.ts` (consultas drizzle). La sesión entra por
  Better Auth (`auth.api.getSession`).
- **shared**: `validators.ts` expone `crearSocioSchema`, `actualizarSocioSchema`,
  `listarSociosQuerySchema` — la regla única que consumen api y web.

La decisión central: **monolito con `shared/` como única fuente de verdad del
esquema y la validación**. Se defiende contra la constitución (principio 2) y D1:
una sola regla de negocio, un solo lugar; evita que cliente y servidor discrepen.

## 3. Interfaces & contracts

- `GET /api/socios` → `{ total, pagina, porPagina, filas[] }`. Query: `q`
  (fragmento RUT/nombre), `estado`, `activo`, `pagina`, `porPagina`.
- `GET /api/socios/:id` → un socio o 404.
- `POST /api/socios` → 201 con el socio; 409 si el RUT existe; 400 si inválido.
- `PATCH /api/socios/:id` → 200 con el socio; 400/404/409 según el caso.
- `DELETE /api/socios/:id` → 200 con `activo=0`; 404 si no existe o ya inactivo.
- Todas las rutas: sin sesión → 401.

El contrato exacto de campos lo fija `shared/src/validators.ts`; el de forma de
la respuesta, `api/src/socios/repo.ts` y el cliente `web/src/lib/api.ts`.

## 4. Data model & flow

- Entidad `socio` (ya migrada): RUT único, nombre, año, sexo, estado, `activo`,
  email, teléfono, marcas de tiempo.
- Flujo de alta: formulario → normaliza RUT → valida Zod → repo inserta → lista
  se invalida y reconsulta.
- Flujo de baja: `DELETE` → `activo = 0` (no borra fila) → la fila sigue en el
  padrón marcada inactiva.
- Sin migración nueva en M1: el esquema ya existe.

## 5. Testing strategy

| Criterio | Nivel | Qué afirma | Qué finge |
|---|---|---|---|
| AC1 (sin sesión → 401) | integración | la ruta corta sin sesión | — |
| AC2 (alta → aparece) | integración | crear persiste y lista | — |
| AC3 (RUT duplicado → 409) | integración | unicidad se rechaza | — |
| AC4 (RUT malo → 400) | unidad + integración | el validador rechaza | — |
| AC5 (búsqueda filtra) | integración | `q` filtra por RUT/nombre | — |
| AC6 (baja → inactivo) | integración | `activo=0`, fila persiste | — |
| AC7 (rebaja → 404) | integración | idempotencia de la baja | — |
| UI (tabla + formulario) | e2e navegador | render con fila y vacío | Chrome/CDP |

Las comprobaciones se ejecutan contra el sistema en marcha (API viva + base
real); la evidencia queda en la salida de cada petición y en el script
`api/scripts/e2e-socios-ui.mjs`. No hay suite Vitest con archivos de prueba aún:
la verificación de M1 es por peticiones reales + E2E, no por mocks.

## 6. Sequencing & dependencies

1. `shared`: validadores (`crear`, `actualizar`, `listar`).
2. `api`: middleware de sesión → repo → rutas → montaje.
3. `web`: cliente api → formulario → página → navegación del shell.
4. Verificación end-to-end (AC1–AC7 + UI).
5. Revisión adversarial tier 2 + cierre.

## 7. Risks & open decisions

| Riesgo | Disparador | Impacto | Mitigación |
|---|---|---|---|
| `rsc risk` tier 2 por `auth` | archivo `middleware/auth.ts` | bloquea push | ASDD completo + revisión adversarial + aprobación humana |
| Suites de test sin archivos | `npm test` sale 1 ("no test files") | verificación por mocks no existe | aceptado: M1 se verifica por E2E real; TDD estricto queda en `strict_tdd: false` |
| RUT con variantes de formato | socio ingresa puntos/guion | duplicados | normalización en formulario y servidor (principio 4) |
| Sin rol por operación | cualquiera con sesión escribe | riesgo de autorización | diferido al módulo de usuarios/roles (spec, punto aclarar) |

## Tasks
<!-- generated by tasks on 2026-11-16; IDs are stable, do not renumber -->

| ID | [P] | Task | Done-check | Depends-on | Trace | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| T001 | [P] | Add validadores de socio en `shared` | `npm run typecheck -w shared` → 0; `crearSocioSchema`, `actualizarSocioSchema`, `listarSociosQuerySchema` exportados | — | AC4 | 1 |
| T002 |  | Add `requireSession` en la API | `GET /api/socios` sin sesión → 401 observado | T001 | AC1 | 2 |
| T003 |  | Add repo de socios (drizzle) | typecheck api → 0; alta/lectura/baja consultan `socio` | T001 | AC2,AC6 | 1 |
| T004 |  | Add rutas CRUD `/api/socios` + montaje | curl: 201 alta, 409 duplicado, 400 RUT malo, 200 baja, 404 rebaja | T002,T003 | AC2,AC3,AC4,AC6,AC7 | 2 |
| T005 | [P] | Add cliente api web + formulario | `npm run build -w web` → 0; `lib/api.ts` + `SocioForm` | T001 | AC4 | 1 |
| T006 |  | Add página `SociosPage` + navegación shell | build web → 0; tabla + buscador + modal renderizan | T005 | AC2,AC5 | 1 |
| T007 |  | Verificar end-to-end (AC1–AC7 + UI) | E2E navegador `E2E_SOCIOS_UI_OK`; peticiones reales AC1–AC7 registradas | T002–T006 | AC1–AC7 | 1 |
| T008 |  | Cierre: typecheck+build 3 workspaces + revisión adversarial | `npm run typecheck` y `build` 0; panel tier 2 grabado | T007 | all ACs | 2 |

**T002 — Interfaces**
- Consume: `auth.api.getSession({ headers })` → `{ session, user } | null` (Better Auth).
- Produce: `c.set('session', …)` / `c.set('user', …)`; sin sesión → `401 { error }`.

**T004 — Interfaces**
- Consume: `requireSession` (T002); `socioPorRut`, `crearSocio`, `actualizarSocio`, `desactivarSocio` (T003).
- Produce: `GET /api/socios` → `{ total, pagina, porPagina, filas[] }`; `POST` → 201 | 409 | 400; `PATCH` → 200 | 400 | 404 | 409; `DELETE` → 200 (activo=0) | 404.

## Review Workload Forecast

| Dimension | Forecast | Why |
| --- | --- | --- |
| Estimated changed lines | ~500 (11 archivos) | shared + api + web + scripts + docs |
| Files / areas | 11: shared/validators, api/{middleware,socios,app}, web/{lib,components,pages,main,Shell}, scripts | CRUD vertical slice |
| Risk | tier 2 (clase `auth`); 3 tareas tier 2 (T002, T004, T008) | middleware de sesión |
| Suggested delivery | ask-on-risk | tier 2 exige aprobación humana |
