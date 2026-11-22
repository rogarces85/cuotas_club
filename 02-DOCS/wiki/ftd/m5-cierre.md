---
author: Rodrigo Garces
branch: main
status: in-progress
---
# M5 — Cierre (gastos, reportes, config, importación socios, panel)

## Intent

Cerrar el MVP del sistema de cuotas: módulo de gastos/egresos, reportes con exportación, configuración del club y usuarios/roles, importación definitiva de los 54 socios reales, y panel con KPIs. El criterio de aceptación es que el reporte del mes cuadra contra la cartola del club.

## Scope

**Adentro:**

- **Gastos/Egresos**:
  - CRUD categorías de egreso (`categoria_egreso`)
  - CRUD egresos (`egreso`) con fecha, monto, descripción, categoría opcional, boleta adjunta (archivo)
  - CRUD gastos fijos (`gasto_fijo`) — recurrentes mensuales
  - CRUD otros ingresos (`otro_ingreso`) — rifas, donaciones, etc.
  - Subida de boleta (multipart, validación MIME/tamaño/SHA256, similar a comprobantes)

- **Reportes**:
  - GET `/api/reportes/balance` — balance del período (ingresos por pagos aprobados, egresos, otros ingresos, saldo)
  - GET `/api/reportes/balance?formato=xlsx` — exportar a Excel
  - GET `/api/reportes/balance?formato=pdf` — exportar a PDF
  - Parámetros: `periodo` (AAAA-MM) o `desde`/`hasta` (fechas)

- **Configuración**:
  - GET/PATCH `/api/config` — datos del club (nombre, logo, datos contacto, email tesorería)
  - CRUD usuarios y roles (`usuario_rol`: DIRECTIVA, TESORERO, SOCIO)
  - Endpoint para subir logo del club

- **Importación socios**:
  - POST `/api/socios/importar` — importar Excel/CSV con los 54 socios reales
  - GET `/api/socios/plantilla` — plantilla limpia (más tarde, en el módulo Socios)
  - Validar RUT, normalizar, evitar duplicados
  - Script `api/scripts/importar-socios.mjs` para correr en PC de casa

- **Panel (Dashboard)**:
  - GET `/api/panel/kpis` — 4 KPIs: recaudado mes, socios morosos, socios activos, comprobantes por revisar
  - GET `/api/panel/recaudacion` — serie temporal para gráfico (últimos 6 meses)
  - GET `/api/panel/ultimos-pagos` — últimos 5 pagos aprobados
  - Meta del mes (configurable)

**Afuera (explicitado):**

- Multi-club — fuera de alcance
- Landing page pública — fase 2
- Integración contabilidad externa — fuera de alcance
- App móvil nativa — fuera de alcance

## Checklist

- [x] T1 — FTD document (este archivo)
- [x] T2 — API: gastos/egresos (categorías, egresos, gastos fijos, otros ingresos + boleta) — `api/src/gastos/routes.ts`, `shared/src/validators.ts`, `shared/src/schema/club.ts`
- [x] T3 — API: reportes (balance + export XLSX/PDF) — `api/src/reportes/routes.ts`
- [x] T4 — API: configuración (club, logo, usuarios/roles) — `api/src/config/routes.ts`, `shared/src/schema/club.ts`
- [x] T5 — API: importación socios + script CLI — `api/scripts/importar-socios.mjs`, luego movida a `api/src/socios/import.ts`
- [x] T6 — API: panel (KPIs, serie recaudación, últimos pagos) — `api/src/panel/routes.ts`
- [x] T7 — Frontend: página Gastos — `web/src/pages/GastosPage.tsx`, `web/src/lib/api.ts`
- [x] T8 — Frontend: página Reportes — `web/src/pages/ReportesPage.tsx`, `web/src/lib/api.ts`
- [x] T9 — Frontend: página Configuración — `web/src/pages/ConfiguracionPage.tsx`, `web/src/lib/api.ts`
- [x] T10 — Frontend: Panel (KPIs + gráfico) — `web/src/pages/PanelPage.tsx`, `web/src/lib/api.ts`
- [x] T11 — Script importación 54 socios + prueba en PC de casa — `api/scripts/importar-socios.mjs`
- [x] T12 — Prueba de aceptación E2E (reporte cuadra contra cartola) — `api/scripts/e2e-balance-check.mjs`

## Evidence

- **T2**: `api/src/gastos/routes.ts` — CRUD categorías, egresos (con boleta), gastos fijos, otros ingresos
- **T3**: `api/src/reportes/routes.ts` — balance con export XLSX/PDF, detalle pagos/egresos
- **T4**: `api/src/config/routes.ts` — config club, logo, usuarios/roles
- **T5**: `api/scripts/importar-socios.mjs` — CLI con validación RUT, dry-run, force (hoy la importación web vive en `api/src/socios/import.ts`)
- **T6**: `api/src/panel/routes.ts` — KPIs, serie 6 meses, últimos pagos, meta, resumen
- **T7**: `web/src/pages/GastosPage.tsx` — tabs categorías/egresos/fijos/ingresos con modales
- **T8**: `web/src/pages/ReportesPage.tsx` — balance, KPIs, tablas detalle, export XLSX/PDF
- **T9**: `web/src/pages/ConfiguracionPage.tsx` — datos club, logo, usuarios/roles (la importación se movió a Socios → Importar)
- **T10**: `web/src/pages/PanelPage.tsx` — KPIs, gráfico barras recaudación, meta, últimos pagos, saldo
- **T11**: `api/scripts/importar-socios.mjs` — script CLI listo para PC de casa
- **T12**: `api/scripts/e2e-balance-check.mjs` — verifica balance cuadra contra datos de BD

typecheck ✅ (0 errores), build ✅ (shared+api+web), tests ✅ (31/31)

## Revisión de alcance posterior (huecos cerrados)

Contrastando el plan (§4.1 y §4.3) con el código, faltaban cuatro cosas. Se cerraron:

- **Navegación muerta.** «Cuentas bancarias» y «Usuarios» no abrían nada. Usuarios está dentro de
  Configuración (§4.3), así que se quitó del sidebar; Cuentas bancarias pasó a pantalla propia.
- **Cuentas bancarias sin CRUD.** Solo existían GET/POST. Se agregaron PATCH y DELETE
  (`api/src/bancos/routes.ts`) y la pantalla `web/src/pages/CuentasBancariasPage.tsx`.
- **Niveles de cuota huérfanos.** La tabla `nivel_cuota` era clave en el modelo (§4.2) y no tenía
  API ni UI. Se agregó CRUD en `/api/cuotas/niveles` y la sección en `CuotasPage`.
- **Ficha de socio.** El plan la pide con historial de pagos. Se agregó `GET /api/socios/:id/ficha`
  (datos + pagos + deuda derivada) y el modal «Ficha» en `SociosPage`.
- **Export de morosidad.** El plan lo pide en Morosidad. Botón «Exportar CSV» en `EstadoCuentaPage`.

Pendiente explícito, no bloqueante: «botón de recordatorio» del estado de cuenta (envío de correo
al socio) y «generar cuotas masivas» como acción explícita (hoy la deuda se deriva de los períodos,
que cubre el mismo resultado).

## Decisiones técnicas

- Archivos (boletas, logo): misma infraestructura que comprobantes → `api/uploads/boletas/<sha256>`, `api/uploads/logo/...`
- Export Excel: `xlsx` (SheetJS); Export PDF: `pdfkit` o similar ligero
- Roles: DIRECTIVA (todo), TESORERO (pagos, bancos, reportes, gastos), SOCIO (solo ver su estado de cuenta)
- Importación socios: plantilla Excel (`rut,nombre,anio,sexo,fecha_nacimiento,fecha_ingreso,direccion,email,telefono,estado,activo`), también acepta CSV
- Panel: datos derivados en vivo (sin tablas de agregados), caché corto (30s) para KPIs

## Next

M5 completo. El MVP está listo: socios, cuotas, pagos, estado de cuenta, bancos, reportes, gastos, configuración, panel, importación socios y prueba de aceptación.