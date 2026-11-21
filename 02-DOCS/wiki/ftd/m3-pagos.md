---
author: Rodrigo Garces
branch: main
status: done
---
# M3 — Pagos (CRUD + aprobación + estado de cuenta)

## Intent

Dar a la tesorero una bandeja para revisar comprobantes subidos por socios, aprobarlos o rechazarlos, y ver el estado de cuenta de cada socio (qué debe, qué pagó). Es el tercer módulo después de socios y cuotas.

## Scope

**Adentro:**

- **GET /api/pagos** — listado de pagos pendientes con filtro por estado
- **GET /api/pagos/:id** — detalle de un pago con comprobante
- **POST /api/pagos** — registrar pago manual (directa, sin comprobante)
- **PATCH /api/pagos/:id/aprobar** — aprobar un pago pendiente
- **PATCH /api/pagos/:id/rechazar** — rechazar un pago pendiente
- **GET /api/pagos/morosos** — lista de socios con deuda pendiente (estado de cuenta)
- **Página Pagos**: bandeja de revisión con botones Aprobar/Rechazar
- **Página Estado de cuenta**: por socio, cuotas pagadas y pendientes
- Protección de todas las rutas con autenticación (cookie de Better Auth)

**Afuera (explicitado):**

- Subida de archivo de comprobante (archivo físico) — se deja para M4
- Importación automática de cartola bancaria — fuera de alcance
- Notificaciones por correo al aprobar/rechazar — fuera de alcance (D5 configurado pero no implementado)

## Checklist

- [x] T1 — FTD document (este archivo)
- [x] T2 — API: rutas CRUD de pagos + aprobación/rechazo + morosos (commit 32fb53e)
- [x] T3 — Frontend: página de pagos (bandeja de revisión) — `web/src/pages/PagosPage.tsx`
- [x] T4 — Frontend: página de estado de cuenta por socio — `web/src/pages/EstadoCuentaPage.tsx`
- [x] T5 — Frontend: integrar en navegación del shell — `Shell.tsx` + `App.tsx`
- [x] T6 — Prueba de aceptación end-to-end — typecheck ✅, build ✅, tests ✅ (31/31), API health ✅

## Evidence

- **T2**: API routes en `api/src/pagos/routes.ts` + repo en `api/src/pagos/repo.ts` (32fb53e)
- **T3**: `web/src/pages/PagosPage.tsx` — listado con búsqueda/paginación/filtro estado, modal crear, modal detalle con Aprobar/Rechazar + motivo
- **T4**: `web/src/pages/EstadoCuentaPage.tsx` — lista morosos con acordeón detalle períodos pendientes
- **T5**: `web/src/components/Shell.tsx` + `web/src/App.tsx` — navegación 'Pagos', 'Morosidad', 'Estado de cuenta'
- **T6**: `npm run typecheck` (0 errores), `npm run build` (shared+api+web), `npm test` (31 tests pasan), API `/health` OK, `/api/pagos` responde 401 sin sesión

## Next

M4 — Subida de comprobante (archivo), importación cartola bancaria, notificaciones correo.

## Decisiones técnicas

- Estados de pago: PENDIENTE → APROBADO | RECHAZADO
- Un socio puede tener múltiples pagos pendientes (uno por período)
- El estado de cuenta se deriva de `pago` + `pago_mes`: un socio debe si tiene períodos sin pago aprobado

## Next

T2 — API: crear rutas CRUD de pagos con aprobación/rechazo.
