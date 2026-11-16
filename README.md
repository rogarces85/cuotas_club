# Cuotas — Osorno Runners

Sistema de gestión de cuotas para el club **Osorno Runners**.

Cobra cuotas, registra pagos por transferencia con comprobante, valida quién pagó y muestra quién debe. Reemplaza las planillas de Excel y los mensajes sueltos.

## Estado

**Fase de planificación cerrada.** No hay código de aplicación todavía.

| Fase | Qué es | Estado |
|---|---|---|
| Fase 1 — MVP | Sistema interno (dashboard) para directiva y socios | Lista para arrancar M0 |
| Fase 2 — Landing page | Sitio público del club | No iniciada, por diseño |

## Documentación

Toda la documentación vive en [`02-DOCS/wiki/`](02-DOCS/wiki/index.md). Ese es el punto de entrada.

| Documento | Qué contiene |
|---|---|
| [Índice de la wiki](02-DOCS/wiki/index.md) | Entrada. Lee esto primero |
| [Contexto existente](02-DOCS/wiki/product/contexto-existente.md) | La base de datos que ya existe, los 54 socios y los entornos |
| [Plan de trabajo](02-DOCS/wiki/product/plan-de-trabajo.md) | Alcance, módulos, hitos y decisiones |
| [Arquitectura](02-DOCS/wiki/product/arquitectura.md) | Stack con versiones verificadas, estructura y riesgos |
| [Marca y paleta](02-DOCS/wiki/product/marca-y-paleta.md) | Colores del club medidos del logo, tokens CSS |
| [Vista previa del panel](02-DOCS/preview/panel-osorno-runners.html) | HTML estático con la paleta aplicada |

## Stack

Node.js · Hono · Drizzle ORM · Better Auth · React · React Hook Form · TanStack Query · shadcn/ui con Tailwind CSS · Zustand.

Base de datos: MariaDB (XAMPP). Detalle y versiones en [arquitectura](02-DOCS/wiki/product/arquitectura.md).

## Identidad

Paleta oficial: **rojo `#DF022F`, negro `#000000`, blanco `#FFFFFF`**. Valores medidos del logo del club, no estimados.

## Puesta en marcha del entorno de trabajo

Este repositorio usa [rsc-harness](https://github.com/ericrisco/rsc-harness) para organizar documentación, skills y reglas de trabajo. El estado de máquina no se versiona.

Después de clonar:

```bash
npx @ericrisco/rsc@4.1.7 sync
```

Eso reconstruye las skills y los hooks que el proyecto declara en `.rsc.json`.

## Estructura prevista

```
shared/    esquema Drizzle y validadores Zod, compartidos
api/       backend Hono (Better Auth montado, rutas, migraciones)
web/       frontend React (shadcn, pantallas, stores)
```

Todavía no existen. Se crean en M0.

## Nota sobre datos

Los datos reales del club viven en el PC de casa. La importación de los 54 socios está planificada para el cierre del proyecto (M5), no para el arranque. Ver [contexto existente](02-DOCS/wiki/product/contexto-existente.md).
