---
title: Reporte de Socios y exportación de pagos
type: feature
status: done
updated: 2026-11-22
---
# Reporte de Socios y exportación de pagos

## Intent

Entregar a la directiva una vista agregada del padrón para gráficas (sexo,
estado, edad, altas por mes) y una descarga de pagos filtrable por año y tipo
de socio. La API ya existía para el balance; este módulo agrega el Service
Layer y el Controller del reporte de socios.

El stack es el del proyecto: **Hono + TypeScript + Drizzle ORM + MariaDB**.

## Arquitectura

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Contrato | `shared/src/validators.ts` | `reporteSociosQuerySchema`, `exportarPagosQuerySchema` |
| Service | `api/src/reportes/socios-service.ts` | Período, filtros, consultas, métricas y filas de exportación |
| Export | `api/src/reportes/socios-export.ts` | CSV y XLSX |
| Controller | `api/src/reportes/routes.ts` | `GET /socios` y `GET /descarga/pagos` |
| Montaje | `api/src/app.ts` | `/api/reportes` y alias `/api/reporte` |
| UI | `web/src/pages/ReportesPage.tsx` + `web/src/components/ReporteSociosPanel.tsx` | Pestaña «Socios y pagos»: filtros, métricas, gráficas y descargas |

## Endpoints

### `GET /api/reportes/socios`

| Parámetro | Valores | Default |
|---|---|---|
| `anio` | 2020–2100 | año actual |
| `periodo` | `Anio`, `Trimestre`, `Mes` (sin importar tildes/mayúsculas) | `Anio` |
| `trimestre` | 1–4 | trimestre actual si es el año actual; si no, 1 |
| `mes` | 1–12 | mes actual si es el año actual; si no, 1 |
| `socios` | `Activos`, `Inactivos`, `Membresía`, `Becado`, `Hombres`, `Mujeres`, `Indefinido`, `Todos` | sin filtro |

`socios` acepta repetido (`?socios=Activos&socios=Hombres`) o separado por coma.
Ejemplo:

```text
/api/reportes/socios?periodo=Trimestre&anio=2026&trimestre=4&socios=Activos&socios=Hombres
```

Interpretación de filtros:

- `Activos` / `Inactivos` → flag `socio.activo`.
- `Membresía` / `Becado` → `socio.estado`.
- `Hombres` / `Mujeres` / `Indefinido` → `socio.sexo`.
- Combinar `Activos` con `Inactivos` devuelve 400.

Respuesta (resumen):

```json
{
  "periodo": { "clave": "2026-T4", "etiqueta": "Cuarto trimestre 2026", "inicio": "2026-10-01", "fin": "2026-12-31", "meses": ["2026-10", "2026-11", "2026-12"] },
  "filtros": { "socios": ["Activos", "Hombres"], "activo": true, "estados": [], "sexos": ["HOMBRE"] },
  "resumen": {
    "totalSocios": 1, "activos": 1, "inactivos": 0,
    "conEmail": 1, "sinEmail": 0,
    "conFechaNacimiento": 1, "conFechaIngreso": 1, "edadPromedio": 36,
    "recaudacionPeriodo": 15000, "pagosAprobados": 2,
    "sociosPagadores": 1, "promedioPorPago": 7500
  },
  "porSexo": [{ "clave": "HOMBRE", "etiqueta": "Hombres", "total": 1 }],
  "porEstado": [{ "clave": "ACTIVO", "etiqueta": "Activo", "total": 1 }],
  "porRangoEdad": [{ "clave": "30_44", "etiqueta": "30 a 44", "total": 1 }],
  "nuevosPorMes": [{ "clave": "2026-10", "etiqueta": "oct 2026", "total": 0 }],
  "pagos": {
    "porMes": [{ "clave": "2026-10", "etiqueta": "oct 2026", "monto": 15000, "cantidad": 2 }],
    "porTipoCuota": [{ "clave": "ACTIVO", "etiqueta": "Activo", "monto": 15000, "cantidad": 2 }]
  }
}
```

- Los meses sin datos vienen en cero para que las gráficas no tengan huecos.
- `recaudacionPeriodo` solo cuenta pagos `APROBADO`.
- `nuevosPorMes` se calcula con `fecha_ingreso` dentro del período.

### `GET /api/reportes/descarga/pagos`

| Parámetro | Valores | Default |
|---|---|---|
| `anio` | 2020–2100 | año actual |
| `socios` | mismos filtros que el reporte | sin filtro |
| `estadoPago` | `TODOS`, `APROBADO`, `PENDIENTE`, `RECHAZADO` | `TODOS` |
| `formato` | `csv`, `xlsx` | `xlsx` |

- El **año** filtra por `fecha_pago` (año en que se pagó), no por el año de la
  cuota; ese se exporta en su propia columna.
- CSV: `;` como separador, BOM UTF-8 y escape de fórmulas (`= + - @`).
- XLSX: hoja **Pagos** con autofiltro + hoja **Filtros** con el resumen.
- Límite defensivo de 10.000 filas.

### Alias

`/api/reporte/*` (singular) queda montado como alias de `/api/reportes/*` para
clientes que usaron la ruta del enunciado original.

## Decisiones de consulta

- **Rangos semiabiertos** (`>= inicio`, `< fin`) para usar `pago_fecha_idx` sin
  funciones sobre la columna. `MONTH()`/`DATE_FORMAT()` en el WHERE anularían
  el índice; se usan solo en SELECT/GROUP BY después de filtrar.
- Fechas construidas en **hora local** porque `fecha_pago` es `DATE` y mysql2 la
  serializa con la fecha local del servidor (Chile). Evita el corrimiento de un
  día que produciría usar UTC.
- Los filtros de socios se aplican antes del JOIN con pagos; el JOIN usa
  `pago_socio_idx`. Si el padrón crece, conviene un índice compuesto
  `(activo, estado, sexo)`.
- Las métricas se agregan en SQL (COUNT/SUM/GROUP BY); no se traen todas las
  filas al servidor para contarlas.
- El export usa `innerJoin` con `socio` para aplicar los filtros actuales; el
  nombre histórico del pago se conserva en `nombreSnapshot`.

## Frontend

La página **Reportes** tiene dos pestañas:

- **Socios y pagos** (por defecto): filtros de período/año/trimestre/mes y
  chips de socios (`Activos`, `Inactivos`, `Hombres`, `Mujeres`, `Indefinido`,
  `Membresía`, `Becado`). Muestra tarjetas de resumen, barras de sexo, estado,
  edad, altas por mes, recaudación por mes, monto por tipo de cuota y datos de
  contacto. La descarga CSV/XLSX usa los mismos filtros y permite elegir el
  estado del pago.
- **Balance**: el formulario y los reportes financieros que ya existían.

Las gráficas son CSS/SVG simples, sin agregar una librería de charts. El panel
consume los endpoints reales y se refresca solo al cambiar los filtros.

## Fuera de alcance

- Exportación por año de cuota (`pago.anio`); hoy el año es el de pago.
- Paginación/streaming de más de 10.000 filas.
- Filtro por rango de fechas arbitrario; el período es año/trimestre/mes.

## Evidencia

- Tests: `npm test -w api` → **84/84**, incluidos 13 del reporte (período,
  filtros, agregados, exportación CSV/XLSX y escape de fórmulas).
- Verificación API: `node api/scripts/verify-reportes-socios.mjs` → **9/9**:
  deltas de padrón y recaudación, filtros repetidos, 400 de filtro inválido,
  CSV con BOM, XLSX con dos hojas y 401 sin sesión.
- UI: `node web/scripts/e2e-reportes.mjs` → **11/11**: pestañas, métricas,
  filtros combinados, limpieza, cambio de período, descarga CSV real, regreso
  al formulario de balance y reporte sin desborde a 390 px.
- Typecheck y build de los tres workspaces en 0.
