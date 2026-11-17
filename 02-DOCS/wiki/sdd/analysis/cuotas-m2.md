---
title: Análisis de consistencia — cuotas-m2
type: analysis
timestamp: 2026-11-16T20:40:00-03:00
---

# Análisis — Cuotas del período (M2)

Cross-read de constitución ↔ spec ↔ plan ↔ tasks.

## Veredicto

`GATE: PASS` — 0 CRITICAL, 0 HIGH, 2 MEDIUM.

## Mapa de cobertura

| REQ | Requisito (corto) | Plan | Task(s) | Estado |
| --- | --- | --- | --- | --- |
| AC1 | Sin sesión → rechazo | §3 | T004, T006 | covered |
| AC2 | Crear período → registrado | §3 | T002, T004, T005 | covered |
| AC3 | Período duplicado → rechazo | §3 | T004 | covered |
| AC4 | Deuda = activos sin pago | §3, §4 | T003, T005, T006 | covered |
| AC5 | Inactivo excluido | §4 | T003 | covered |
| AC6 | Mes inválido → rechazo | §3 | T001, T004 | covered |
| AC7 | Quien pagó excluido | §4 | T003, T006 | covered |

Sin GAP ni DRIFT.

## Hallazgos

| # | Severidad | Tipo | Art A (loc) | Art B (loc) | Conflicto | Resolver en |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | MEDIUM | Ambiguity | spec §Points to clarify (suposición monto) | plan §7 (riesgo monto) + `shared/schema/club.ts` | El mapeo `socio.estado → nivel_cuota.tipo` depende de que ambos vocabularios coincidan, pero `estado` (varchar libre) y `tipo` (varchar libre) no son enum; un socio con estado sin nivel correspondiente queda con monto indefinido | tasks (validar mapeo) |
| F2 | MEDIUM | Ambiguity | spec AC4 (monto según tipo) | plan §4 (deuda JOIN nivel_cuota) | `nivel_cuota` está vacío (0 filas); sin datos, la deuda calcula monto nulo y AC4 no se puede demostrar de verdad hasta cargar niveles de prueba | tasks (montos de prueba) |

## Por qué importan

- **F1** — si el tesorero escribe un estado fuera del vocabulario de niveles
  (p. ej. "SUSPENDIDO"), el JOIN no encuentra nivel y el monto queda indefinido.
  No rompe hoy (M2 usa datos de prueba), pero es el tipo de drift que M3/M4
  heredan.
- **F2** — `nivel_cuota` vacío significa que el criterio AC4 (monto por tipo)
  solo es demostrable tras sembrar niveles de prueba. El plan ya lo prevé
  ("montos de prueba en M2"), pero el gate lo marca para que no se olvide.

## Enrutado recomendado

- **F1** → `tasks`/`implement`: validar el mapeo estado→nivel al calcular la
  deuda (un socio sin nivel → monto 0 + señal, no romper).
- **F2** → `implement`: sembrar `nivel_cuota` de prueba (ACTIVO/MEMBRESIA/BECADO)
  como parte de la verificación.
