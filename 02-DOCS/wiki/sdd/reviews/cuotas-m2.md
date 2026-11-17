---
title: Consolidación de revisión adversarial — cuotas-m2
type: review-consolidation
timestamp: 2026-11-16T21:00:00-03:00
---

# Consolidación — Revisión adversarial tier 2 (cuotas-m2)

Tres refutadores fresh-context sobre HEAD `c72a19c` + árbol de trabajo.

| Lens | Veredicto inicial |
| --- | --- |
| correctness | CHANGES REQUESTED (2 should-fix, 1 nit, 1 question) |
| security | APPROVE (1 nit) |
| tests | CHANGES REQUESTED (3 blocker, 2 should-fix, 1 nit) |

## Hallazgos únicos y su resolución

### Corregidos (blocker / should-fix)

- **S1 — Cardinalidad de la deuda.** El LEFT JOIN a `nivel_cuota` podía duplicar
  la fila del socio si existían dos niveles activos con el mismo `tipo`
  (la tabla no tiene únicos sobre `tipo`). **Corregido:** la consulta usa una
  subconsulta que deduplica por tipo (`min(monto_clp)` agrupado por `tipo`),
  garantizando a lo sumo una fila de nivel por socio. Test de regresión añadido
  (`deuda.test.ts`: "no duplica un socio cuando hay niveles duplicados").

- **S2 — Race check-then-insert → 500.** Dos POST concurrentes al mismo mes
  pasaban ambos el chequeo y el segundo chocaba con el índice único sin capturar
  `ER_DUP_ENTRY`. **Corregido:** la ruta captura el código 1062 y devuelve 409.

- **B1 — `calcularDeuda` sin test automatizado.** **Corregido:** test de
  integración contra la base de descarte `osorno_runners_v2_test`
  (`api/src/cuotas/deuda.test.ts`) que cubre AC4 (deuda = activos sin pago),
  AC5 (inactivo excluido), AC7 (pagado excluido) y monto por tipo.

- **B2 — `verify-cuotas.mjs` no limpiaba ni era idempotente.** **Corregido:**
  el script limpia al inicio y al final (físico vía mysql2) y usa RUT/período
  fijos que se purgan; verificado con dos ejecuciones seguidas (9/9 ambas).

- **B3 — No se probaba AC7 ni el monto por tipo.** **Corregido:** el script
  siembra un `pago_mes` real (socio D) y verifica su exclusión; siembra socio
  MEMBRESIA y verifica monto 10000.

- **Nit — tests stale en `dist/`.** **Corregido:** `vitest.config.ts` con
  `include: ['src/**/*.test.ts']` evita recoger artefactos compilados.

### Nits/questions (registrados, no bloquean)

- **N1 — N+1 en `listarPeriodos`** (una consulta de deuda por período). Solo
  rendimiento; `totalDeudores` es correcto. Aceptado para M2.
- **Q1 — Día 31 en meses de 30 días.** `diaVencimiento` acepta 1–31 sin validar
  contra la longitud del mes. La spec lo declara riesgo diferido; se resuelve
  cuando M3/M4 interpreten el vencimiento como fecha real.

## Estado

Los findings bloqueantes se corrigieron y se re-verificaron:
`npm test` 31/31, `verify-cuotas.mjs` 9/9 ×2, `typecheck` y `build` en 0.
