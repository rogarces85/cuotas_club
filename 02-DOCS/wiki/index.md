---
title: Wiki — Osorno Runners
type: index
updated: 2026-11-16
---

# Wiki — Sistema de cuotas Osorno Runners

Punto de entrada. Lee esto antes de actuar sobre el proyecto.

## Producto

| Documento | Qué contiene |
|---|---|
| [Contexto existente](product/contexto-existente.md) | **Lee esto primero.** La base `osorno_runners` ya tiene 54 socios y un esquema completo. Hay tres intentos previos en `htdocs` |
| [Plan de trabajo](product/plan-de-trabajo.md) | Fases, alcance del MVP, módulos, hitos, riesgos y decisiones |
| [Arquitectura](product/arquitectura.md) | Stack con versiones verificadas, estructura de carpetas, decisiones técnicas y comandos de M0 |
| [Marca y paleta](product/marca-y-paleta.md) | Colores medidos del logo, escala, tokens CSS, contraste y uso del logo |
| [Vista previa del panel](../preview/panel-osorno-runners.html) | HTML estático con la paleta aplicada. Abrir en el navegador |

## Referencias

| Documento | Qué contiene |
|---|---|
| [Análisis de Cuotapp](reference/analisis-cuotapp.md) | Cómo funciona el SaaS de referencia: dominio, API, planes y flujos |
| [Análisis de Zenith Dashboard](reference/zenith-dashboard.md) | Qué trae la plantilla de interfaz, qué adoptamos y qué descartamos |

## Estado del proyecto

- **Fase actual:** planificación cerrada, lista para M0.
- **Stack:** definido (D1). Ver [arquitectura](product/arquitectura.md).
- **Datos:** base nueva `osorno_runners_v2`, heredando los 54 socios de `osorno_runners`. Ver [contexto existente](product/contexto-existente.md).
- **Decidido:** D0, D1, D2, D3, D4, D5, D6. **No quedan decisiones abiertas.**
- **Diferido a M5:** la importación de los 54 socios, en el PC de casa. Ver [contexto existente](product/contexto-existente.md#dónde-se-ejecuta-dos-entornos).
- **Fase 2 (landing page):** no iniciada, por diseño.

## SDD

| Documento | Qué contiene |
|---|---|
| [Constitución](sdd/constitution.md) | Principios no negociables que heredan todas las fases |
| [Config SDD](sdd/config.yaml) | Calibración de runtime (comandos, runners, review) |
| [Spec — Socios M1](sdd/specs/socios-m1.md) | Contrato WHAT/WHY del módulo de socios |
| [Plan — Socios M1](sdd/plans/socios-m1.md) | Arquitectura, interfaces, tareas y riesgo |
| [Análisis — Socios M1](sdd/analysis/socios-m1.md) | Gate de consistencia entre artefactos |
| [Spec — Cuotas M2](sdd/specs/cuotas-m2.md) | Contrato del módulo de cuotas |
| [Plan — Cuotas M2](sdd/plans/cuotas-m2.md) | Arquitectura, interfaces, tareas y riesgo |
| [Análisis — Cuotas M2](sdd/analysis/cuotas-m2.md) | Gate de consistencia de M2 |
| [Revisión — Socios M1](sdd/reviews/socios-m1.md) | Panel adversarial tier 2 de M1 |
| [Revisión — Cuotas M2](sdd/reviews/cuotas-m2.md) | Panel adversarial tier 2 de M2 |
| [Decisiones SDD](sdd/decisions.md) | Registro append-only de decisiones del ciclo |

## Implementación (FTD)

| Documento | Qué contiene |
|---|---|
| [M0 — base](ftd/m0-base.md) | Workspaces, base de datos, autenticación y tema |
| [M1 — socios](ftd/m1-socios.md) | CRUD, búsqueda y baja lógica |
| [Socios — campos e importación](ftd/socios-campos-importacion.md) | Fechas, sexo cerrado, direcciones y carga masiva en Excel |
| [Cumpleaños](ftd/cumpleanos.md) | Listado del mes, antigüedad y saludo por correo |
| [M3 — pagos](ftd/m3-pagos.md) | Comprobantes, aprobación y estado de cuenta |
| [M4 — cobranza](ftd/m4-cobranza.md) | Morosidad y conciliación bancaria |
| [M5 — cierre](ftd/m5-cierre.md) | Reportes, gastos, configuración y panel |
| [Reporte de socios](ftd/reporte-socios.md) | Métricas del padrón y descarga de pagos CSV/XLSX |

## Identidad en una línea

Club **Osorno Runners**. Paleta **rojo, negro y blanco**. Rojo de marca `#DF022F` (medido del logo). Interfaz con sidebar negra, contenido blanco y rojo como acento.

## Recursos

- Logo: `attachments/brand/logo-osorno-runners.webp`
- Harness: `.rsc.json`, skills en `.rsc/skills/`
- Material de análisis: `../rea_analysis/` (no forma parte del producto)
