---
title: Análisis de consistencia — socios-m1
type: analysis
timestamp: 2026-11-16T20:20:00-03:00
---

# Análisis — Administración de socios (M1)

Cross-read de constitución ↔ spec ↔ plan ↔ tasks. Reporte de hallazgos;
no resuelve nada: cada hallazgo vuelve a su fase dueña.

## Veredicto

`GATE: PASS` — 0 CRITICAL, 0 HIGH, 1 MEDIUM.

## Mapa de cobertura

| REQ | Requisito (corto) | Plan | Task(s) | Estado |
| --- | --- | --- | --- | --- |
| AC1 | Sin sesión → rechazo | §3 | T002 | covered |
| AC2 | Alta → aparece | §3 | T003, T004 | covered |
| AC3 | RUT duplicado → rechazo | §3 | T004 | covered |
| AC4 | RUT mal formado → rechazo | §3 | T001, T004, T005 | covered |
| AC5 | Búsqueda filtra | §3 | T006 | covered |
| AC6 | Baja → inactivo (persiste) | §3, §4 | T003, T004 | covered |
| AC7 | Rebaja → rechazo | §3 | T004 | covered |

Sin GAP: todo criterio tiene tarea. Sin DRIFT: toda tarea traza a un criterio.

## Hallazgos

| # | Severidad | Tipo | Art A (loc) | Art B (loc) | Conflicto | Resolver en |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | MEDIUM | Duplicación | spec §What it must respect (regla única) + constitución 2 | `web/src/components/SocioForm.tsx` (regex RUT/nombre/anio/email locales) | El formulario re-implementa reglas que ya viven en `shared/src/validators.ts` (`rutSchema`, `nombreSchema`, `crearSocioSchema`), en vez de consumirlas | implement |

## Por qué importa F1

Constitución 2 y A4 dicen "una regla de validación, un solo lugar". Hoy ambas
copias coinciden, así que no hay bug observable — pero es exactamente el tipo de
drift que rompe cuando una cambia y la otra no (p. ej. si mañana el RUT admite
otra forma, el servidor la acepta y el formulario la rechaza, o al revés).

Trade-off de dejarlo: el formulario necesita coerción de `anio` (string→number)
que el `crearSocioSchema` compartido no expresa, así que hay una razón técnica
legítima para modelar el formulario por separado. La parte que SÍ debería
importarse es la regla de RUT y nombre/email (sin cambio de comportamiento).

## Enrutado recomendado

- **F1** → `implement`: importar `rutSchema`/`nombreSchema` de `@cuotas-club/shared`
  en `SocioForm` (o registrar como deuda aceptada si se prefiere no tocar código
  ya verificado). No bloquea el cierre de M1.
