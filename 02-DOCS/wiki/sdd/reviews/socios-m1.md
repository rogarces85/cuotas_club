---
title: Consolidación de revisión adversarial — socios-m1
type: review-consolidation
timestamp: 2026-11-16T20:30:00-03:00
---

# Consolidación — Revisión adversarial tier 2 (socios-m1)

Tres refutadores fresh-context (correctness, security, tests) sobre el estado
HEAD `1bb8ae76` + árbol de trabajo. Verdicts:

| Lens | Veredicto |
| --- | --- |
| correctness | APPROVE (solo nits) |
| security | CHANGES REQUESTED (1 should-fix, 1 nit) |
| tests | CHANGES REQUESTED (1 blocker, 3 should-fix, 1 question) |

## Hallazgos únicos (tras fusionar duplicados)

### Blocker

- **B1 — Sin suite de tests automatizada.** `npm test` corre `vitest run` y sale
  1 ("No test files found"). No hay `*.test.ts` en `api/`. Los AC1–AC7 se
  verificaron con curl manual + E2E de navegador, que no es regresión
  reproducible. Clase: `missing automated regression suite`. Causal (este
  cambio no trajo tests). Evidencia: `npm test` → exit 1, confirmado.

### Should-fix

- **S1 — `activo` es escribible por el cliente (mass assignment).**
  `actualizarSocioSchema` admite `activo: boolean`, así que cualquier sesión
  puede reactivar a un socio dado de baja con un PATCH. El estado activo es
  server-owned (la baja es una transición controlada). Clase:
  `broken-access-control`. Causal. Evidencia: `validators.ts:78`, `repo.ts:103`.

- **S2 — La evidencia de AC2–AC7 no está registrada en un artefacto
  re-ejecutable.** El FTD narra los resultados curl pero no deja un script ni
  transcript que un segundo revisor pueda correr. Clase: `evidence not recorded`.

- **S3 — El E2E no asevera el contenido de la fila ni el flujo completo.**
  `e2e-socios-ui.mjs` solo comprueba encabezados y botón; no crea/edita/da de
  baja por sí mismo ni asevera el RUT formateado. Clase: `superficial E2E`.

### Nits / questions (no bloquean)

- N1 — El formulario promete "se puede reactivar editándolo" pero no expone
  `activo` (correctness). Se resuelve con S1.
- N2 — Divergencia de normalización RUT form vs servidor (correctness, AC4).
- N3 — `%`/`_` sin escapar en el LIKE de búsqueda (correctness).
- N4 — `estado` es string libre, sin enum (security, data-integrity).
- Q1 — Colación de la tabla no fijada; la búsqueda por nombre depende del
  default de BD (correctness).
- Q2 — El RUT no valida dígito verificador (solo forma).

## Decisión de resolución

- **B1 → arreglar:** escribir una suite Vitest para `shared` (validadores,
  lógica pura) y para `api` (repo con base de prueba, o rutas). Es el fix
  honesto de un cambio tier 2.
- **S1 → arreglar:** quitar `activo` de `actualizarSocioSchema`; la
  reactivación será una acción administrativa explícita en el módulo de roles.
- **S2/S3 → arreglar:** dejar un script de verificación re-ejecutable
  (el propio `e2e-socios-ui.mjs` extendido, o un `scripts/verify-socios.mjs`
  que corra los AC).
- **N1–N4, Q1, Q2 → registrar** como deuda/nits; no bloquean el cierre.

## Estado

En el loop de `implement`: findings verificados, fixes en curso (B1, S1, S2/S3).
