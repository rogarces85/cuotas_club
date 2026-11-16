---
author: Rodrigo Garces
branch: main
status: in-progress
---
# M0 — Base del sistema (scaffold, BD, auth, tema)

## Intent

Levantar el esqueleto del sistema sobre el stack decidido: Hono + Drizzle + Better Auth en el
backend, React + Vite + shadcn en el frontend, con la base `osorno_runners_v2` creada y el tema del
club (rojo/negro/blanco) aplicado. Es el cimiento de M1 a M5: sin esto, ningún módulo arranca.

## Scope

**Adentro:**

- Repositorio con npm workspaces: `shared`, `api`, `web`.
- `shared/schema`: esquema Drizzle (tablas del club) y validadores Zod compartidos.
- `api`: app Hono, conexión a `osorno_runners_v2`, Better Auth montado en `/api/auth/*`, middleware
  de sesión, archivo `.env.example`.
- `web`: app React + Vite + Tailwind v4 + shadcn init, tema con la paleta del club (`--primary:
  #DF022F`, sidebar negra), proxy de `/api` hacia Hono.
- Base `osorno_runners_v2` creada en MariaDB, con usuario de app dedicado (no root).
- Migración inicial aplicada y verificada.
- Cierre de M0: login con un usuario de prueba y ver el shell con la paleta.

**Afuera (explícito):**

- CRUD de socios, cuotas, pagos (M1–M3).
- Importación de los 54 socios reales (M5, PC de casa).
- Correo saliente real (solo queda configurado el valor en `.env.example`).
- Landing page (Fase 2).

## Checklist

- [x] T1 — Estructura de workspaces y scripts raíz: `npm install` resuelve las tres carpetas.
- [x] T2 — Base `osorno_runners_v2` creada y usuario de app dedicado con clave, sin usar root.
- [x] T3 — `shared/schema`: tablas Drizzle del club + Zod, tipado compilando.
- [x] T4 — `api`: Hono arranca, conexión a la BD responde, `/api/health` devuelve 200.
- [x] T5 — Better Auth montado en `/api/auth/*` y el esquema de auth migrado.
- [x] T6 — `web`: Vite + Tailwind + shadcn init, proxy `/api` funcionando, tema del club aplicado.
- [x] T7 — Cierre: login de prueba y shell visible con sidebar negra y rojo `#DF022F`.
- [x] T8 — Pantalla de login real: formulario con RHF + Zod, sesión en cookie y shell protegido.

## Evidence

- **T1** — `npm install` resuelve 3 workspaces (203 paquetes). `npm audit`: 4 moderadas transitivas
  de drizzle-kit (documentado en decisions.md), 0 críticas tras subir vitest a 5.1.0.
- **T2** — `osorno_runners_v2` creada (utf8mb4_unicode_ci). Usuario `osorno_app` con clave dedicada,
  conexión verificada: `SELECT CURRENT_USER()` → `osorno_app@localhost`.
- **T3** — `npm run build -w shared` compila limpio. 13 tablas del club + validadores Zod.
- **T4** — `GET /api/health` → `200 {"status":"ok","database":"up"}`.
- **T5** — 16 tablas migradas (13 club + user/session/account/verification). Registro en
  `__drizzle_migrations` (hash `e7f950be…`). Sign-up real: `POST /api/auth/sign-up/email` → 200 con
  token y usuario persistido en BD (luego limpiado).
- **T6** — Vite sirve en 5173, proxy `/api` → 8787 devuelve `200 database:up`. Tailwind compila el
  tema: CSS contiene `#df022f` y `--color-sidebar`.
- **T7** — Shell renderizado: sidebar negra, botón rojo, KPI "Socios morosos". Captura en
  `02-DOCS/preview/m0-shell.png`.

## Decisiones técnicas (registradas en decisions.md)

- vitest fijado a 5.x (2 críticas de RCE resueltas).
- Timestamp → datetime en tablas de auth (ERROR 1067 en MariaDB 10.4).
- Migrator propio `npm run db:migrate` en vez de `drizzle-kit migrate` (reporte de error roto).

## Prueba de aceptación (2026-11-16)

Ejecutada con el sistema levantado: API en `:8787`, web en `:5173`.

| Verificación | Resultado |
|---|---|
| `npm run typecheck` (3 workspaces) | 0 errores |
| `npm run build` | OK — CSS 13,19 kB · JS 230,29 kB (gzip 71,41 kB) |
| `GET /api/health` (directo) | 200, `database: "up"` |
| `GET /api/health` (por proxy Vite) | 200, `database: "up"` |
| `GET /` (frontend) | 200, título presente |
| `POST /api/auth/sign-up/email` | 200, usuario creado |
| `POST /api/auth/sign-in/email` | 200, token emitido |
| `GET /api/auth/get-session` (con cookie) | 200, sesión del usuario |
| `POST /api/auth/sign-in/email` con clave errónea | **401**, rechazado |
| Clave en BD | hash de 161 caracteres (`salt:hash`), nunca texto plano |
| Modelo de rol (`usuario_rol`) | usuario con rol `TESORERO` asignado y consultado por JOIN |
| Render del shell | sidebar negra, botón rojo, KPIs, navegación completa |

**Lo que todavía no se puede probar desde el navegador:** no existe pantalla de login. La
autenticación funciona por API (probada arriba), pero la interfaz es solo el shell. Ese es el
siguiente paso antes de M1.

Usuario de prueba creado: `tesorero@osornorunners.cl`, rol `TESORERO`.

### T8 — Pantalla de login (cerrada)

Se agregó la pantalla de acceso, que faltaba para poder entrar al sistema desde el navegador.

| Verificación | Resultado |
|---|---|
| Sin sesión, `GET /` | Renderiza login ("Sistema de cuotas", campos email y password, botón Ingresar), **no** el shell |
| Cookie de sesión | `HttpOnly`, `Path=/`, `SameSite=Lax`, 7 días |
| **E2E en navegador real** (Chrome por CDP, cookie inyectada) | `shell_visible: true` · `login_oculto: true` · `usuario_en_cabecera: true` · `boton_salir: true` |
| Build de producción | OK — 174 módulos, JS 388,27 kB (gzip 121,26 kB) |

El E2E se ejecuta con `node api/scripts/e2e-session-check.mjs <token> <ruta-chrome>`: abre Chrome
headless, inyecta la cookie de sesión y comprueba que la app muestre el shell en vez del login.

**Nota de honestidad:** los indicadores del panel siguen siendo de muestra. No leen la base de datos
todavía; eso llega en M1–M3 cuando existan los endpoints.

## Next

M1 — CRUD de socios con datos de prueba. Ver `02-DOCS/wiki/product/plan-de-trabajo.md` (§5, M1).
