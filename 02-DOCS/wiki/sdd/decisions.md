# SDD decisions

Registro append-only de decisiones del ciclo SDD. Compartido por
`constitution`, `specify`, `plan`, `implement` y `review`.

## 2026-11-16 — Constitución v1.0.0 ratificada

**Decisión** — ratificar la constitución tal cual fue redactada, sin instalar
skills de stack adicionales por ahora (opción B).

**Por qué** — los 16 principios derivan de decisiones ya tomadas (D1–D6,
A1–A6) y no introducen reglas nuevas. Las skills de stack (react, drizzle-orm,
mysql, typescript) no son necesarias para cerrar M1; se instalan cuando M2 las
requiera.

## 2026-11-16 — M1 escalado a ASDD

**Contexto** — el módulo de socios se construyó primero por la vía FTD, con el
CRUD completo y verificado. `rsc risk` lo clasificó tier 2 por la clase `auth`
(el middleware de sesión).

**Decisión** — escalar a ASDD (pedido explícito del usuario). El FTD
`02-DOCS/wiki/ftd/m1-socios.md` es la entrada de la spec; el código ya escrito
pasa por los gates de ASDD (spec → plan → analyze → revisión adversarial de
tier 2) sin descartarse.

## 2026-11-16 — F1 (duplicación de regla RUT en el formulario): deuda aceptada

**Hallazgo (analyze F1)** — `SocioForm.tsx` re-implementa la regla de RUT en vez
de consumirla de `shared`.

**Decisión** — aceptar como deuda consciente, no corregir en M1.

**Por qué** — el formulario normaliza en el cliente (acepta puntos/guion y los
quita antes de validar), que es una capa de UX deliberada que el `rutSchema`
compartido no expresa. Importar la regla sin tocar `shared` rompería la
normalización; mover la normalización a `shared` cambia el comportamiento del
servidor (aceptaría RUT con puntos) y obligaría a re-verificar. Ambas opciones
valen más que el riesgo que cubren hoy (las dos copias coinciden). Se revisa en
M2, cuando el modelo de validación se toque de nuevo.

## 2026-11-16 — Findings de la revisión adversarial tier 2: resueltos

**S1 (mass-assignment de `activo`)** — CORREGIDO. Se quitó `activo` de
`actualizarSocioSchema` y de `repo.actualizarSocio`. La reactivación será una
acción administrativa explícita, no un campo libre. La UI ya no promete
"reactivar editándolo".

**B1/S2/S3 (sin suite de tests + evidencia no re-ejecutable)** — CORREGIDO.
`npm test` ahora corre 21 tests (17 de validadores + 4 del gate de sesión AC1);
`api/scripts/verify-socios.mjs` es la verificación CRUD re-ejecutable y
autocontenida (9/9 checks, crea y limpia su propio socio).

**Nits/questions (N1–N4, Q1–Q2)** — registrados, no bloquean: divergencia de
normalización RUT (cubierta por F1), `%`/`_` sin escapar, `estado` sin enum,
colación no fijada, sin verificación de dígito verificador.

## 2026-11-16 — M2 (cuotas): modelo periodo_cuota + deuda derivada

**Decisión (usuario)** — las cuotas del período se modelan con una tabla
`periodo_cuota` (mes AAAA-MM único + día de vencimiento) y la deuda es
**derivada**: un socio activo sin `pago_mes` para el período debe; el monto
sale de `nivel_cuota` según su `estado`. No se generan filas masivas por mes.

**Por qué** — evita miles de filas al año y la sincronización con altas/bajas
de socios; el estado de cuenta siempre refleja el padrón vivo.

**Suposiciones registradas en la spec** — el monto se deriva de `nivel_cuota`
(no se fija por período); el vencimiento es día del mes 1–31.

## 2026-11-16 — Findings de la revisión adversarial de M2: resueltos

**S1 (cardinalidad de la deuda)** — CORREGIDO. La consulta deduplica por tipo
con subconsulta (`min(monto_clp)` group by `tipo`), evitando filas duplicadas si
existen dos niveles activos del mismo tipo. Test de regresión añadido.

**S2 (race → 500)** — CORREGIDO. La ruta captura `ER_DUP_ENTRY` (1062) y
devuelve 409.

**B1/B2/B3 (tests)** — CORREGIDO. Test de integración de `calcularDeuda`
contra `osorno_runners_v2_test` (AC4/AC5/AC7 + monto por tipo); `verify-cuotas.mjs`
limpia al inicio y al final (idempotente, verificado 2 veces) y ahora cubre AC7
con un `pago_mes` real.

**Nits/questions** — N+1 en `listarPeriodos` (solo rendimiento, aceptado);
día 31 en meses cortos (riesgo diferido a M3/M4).

