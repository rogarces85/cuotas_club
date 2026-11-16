---
title: Plan de trabajo — Sistema de cuotas Osorno Runners
type: plan
status: draft
updated: 2026-11-16
owner: directiva Osorno Runners
---

# Plan de trabajo — Sistema de cuotas Osorno Runners

## 1. Objetivo

Dar al club una herramienta propia para cobrar cuotas, registrar pagos por transferencia y ver quién debe. Reemplaza planillas de Excel y mensajes sueltos.

El trabajo tiene dos fases. **La fase 2 no empieza hasta que la fase 1 esté cerrada y en uso.**

| Fase | Qué es | Estado |
|---|---|---|
| **Fase 1 — MVP** | Sistema interno (dashboard) para la directiva y los socios | **En planificación** |
| Fase 2 — Landing page | Sitio público del club, después del sistema | No iniciada, por diseño |

## 2. Identidad visual

El sistema usa la paleta oficial del club: **rojo, negro y blanco**.

- Guía completa en [`marca-y-paleta.md`](../product/marca-y-paleta.md): colores medidos del logo, escala, tokens CSS, contraste verificado.
- Logo en `02-DOCS/attachments/brand/logo-osorno-runners.webp`.
- Rojo de marca medido: `#DF022F`. Blanco sobre rojo cumple AA (5.02:1).
- Dirección: **sidebar negra, contenido blanco, rojo solo como acento**.

Referencia de interfaz: [`zenith-dashboard.md`](../reference/zenith-dashboard.md). De ahí tomamos el shell (sidebar agrupada, topbar, `⌘K`), la grilla del panel y los tokens shadcn. Descartamos todo lo que sea de e-commerce o SaaS.

**Vista previa del panel:** [`preview/panel-osorno-runners.html`](../../preview/panel-osorno-runners.html) — la paleta ya aplicada sobre la grilla de referencia, sin frameworks. Sirve para validar la dirección visual antes de elegir stack.

## 3. Decisiones

### 3.1 Resueltas

| # | Decisión | Resultado |
|---|---|---|
| **D1** | **Stack** | **Node.js + Hono + Drizzle ORM + Better Auth + React + React Hook Form + TanStack Query + shadcn/ui con Tailwind CSS + Zustand** |
| **D0** | **Base de datos existente** | Base nueva **`osorno_runners_v2`**, importando los 54 socios. La base vieja queda intacta como respaldo |
| **D2** | **Identificador del socio** | RUT normalizado, sin puntos ni guion (`17682512K`). Decidido por los datos existentes |
| **D3** | **Quién valida los pagos** | **Tesorero o administrador.** Ambos pueden aprobar y rechazar comprobantes |
| **D4** | **Origen del padrón** | Heredar los 54 socios de `osorno_runners.socios`, al final del proyecto |
| **D5** | **Correo saliente** | **`tesoreriaor@gmail.com`** vía Gmail (SMTP `smtp.gmail.com:587` con contraseña de aplicación) |
| **D6** | **Motor de base de datos** | Permanecer en MariaDB 10.4.32, con revisión manual de cada migración |

Todas las decisiones de planificación están cerradas.

Detalle técnico, versiones verificadas, estructura de carpetas y riesgos: [`arquitectura.md`](arquitectura.md).
Contexto de datos, entornos y proyectos previos: [`contexto-existente.md`](contexto-existente.md).

## 4. Alcance del MVP

### 4.1 Módulos

| Módulo | Qué resuelve | Prioridad |
|---|---|---|
| **Socios** | Alta, edición, categoría, estado activo/inactivo, apoderado | Must |
| **Cuotas** | Períodos, monto, vencimiento, generar cuotas masivas | Must |
| **Pagos** | Registrar pago, adjuntar comprobante, aprobar o rechazar | Must |
| **Estado de cuenta** | Por socio: qué debe, qué pagó, saldo | Must |
| **Morosidad** | Lista de socios con cuota vencida, ordenada por antigüedad | Must |
| **Cuentas bancarias** | Datos del club para que el socio transfiera | Must |
| **Usuarios y roles** | Directiva, tesorero, socio | Must |
| **Configuración** | Nombre del club, logo, datos de contacto | Must |
| **Panel** | KPIs, recaudación del mes, últimos pagos | Must |
| **Gastos e ingresos extra** | Salidas de caja y entradas que no son cuotas | Should |
| **Reportes** | Balance del período, exportar a Excel/PDF | Should |
| **Avisos** | Correo al aprobar un pago | Should |

### 4.2 Modelo de datos

Fusiona lo que sirve del esquema existente (`osorno_runners`) con lo aprendido del análisis de Cuotapp ([`analisis-cuotapp.md`](../reference/analisis-cuotapp.md)).

Se descartan del esquema viejo las tablas que el MVP no usa: `miembros`, `vw_saldos`, `compras_items`.

| Tabla | Campos clave | Nota |
|---|---|---|
| `socio` | `rut` (único, normalizado), `nombre`, `anio`, `sexo`, `estado`, `activo` | Hereda los 54 registros |
| `usuario` | tablas de Better Auth | Identidad y sesión |
| `usuario_rol` | `usuario_id`, `rol` (`DIRECTIVA`, `TESORERO`, `SOCIO`) | Roles en tabla propia (A1) |
| `nivel_cuota` | `codigo`, `nombre`, `monto_clp`, `tipo`, `activo` | Cuánto paga cada tipo: ACTIVO, MEMBRESIA, BECADO |
| `pago` | `id_socio`, `anio`, `fecha_pago`, `total_pago`, `valor_cuota`, `tipo_cuota`, `meses_cantidad`, `origen` (`manual`/`banco`/`historico`) | Un pago puede cubrir varios meses |
| `pago_mes` | `id_pago`, `id_socio`, `periodo` (`AAAA-MM`) | El desglose. Permite saber qué mes quedó pagado |
| `comprobante` | `id_pago`, `ruta`, `mime`, `bytes`, `sha256`, `estado` | Archivo privado, acceso autenticado (A5) |
| `cuenta_bancaria` | banco, tipo, número, titular, RUT | Datos para transferir |
| `movimiento_bancario` | fecha, monto, descripción, referencia | Cartola importada |
| `egreso` / `categoria_egreso` | fecha, monto, descripción, boleta | Salidas de caja |
| `gasto_fijo` | descripción, monto, periodicidad | Recurrentes |
| `otro_ingreso` | fecha, monto, descripción, origen | Rifas, donaciones |
| `importacion_estado_cuotas` / `detalle` | período, hoja, integrante, deuda, meses | Para cargar planillas históricas |

`pago` + `pago_mes` es la decisión importante: un socio puede pagar tres meses de una vez, y el sistema tiene que saber exactamente cuáles. Un modelo de "una cuota, un pago" obliga a rehacer todo el historial en marzo.

### 4.3 Pantallas

| Pantalla | Contenido |
|---|---|
| Login | Email y clave. Ingreso al panel |
| Panel | 4 KPIs: recaudado del mes, socios morosos, socios activos, comprobantes por revisar. Gráfico de recaudación. Meta del mes. Últimos 5 pagos |
| Cuotas | Lista de períodos. Crear cuota, monto, vencimiento, generar para todos |
| Pagos | Bandeja con filtro por estado. Ver comprobante. Aprobar / rechazar |
| Socios | Tabla con búsqueda. Ficha con historial de pagos |
| Estado de cuenta | Por socio: cuotas, pagos, saldo, botón de recordatorio |
| Morosidad | Tabla ordenada por deuda. Exportar |
| Cuentas bancarias | CRUD con los datos para transferir |
| Gastos | Registro con boleta adjunta |
| Reportes | Balance del período. Exportar |
| Configuración | Datos del club, logo, usuarios y roles |

## 5. Hitos

Cada hito se cierra con evidencia observada, no con "ya está listo".

| Hito | Entregable | Criterio de cierre |
|---|---|---|
| **M0 — Base** | Proyecto creado, base de datos migrada, login funcionando, tema del club aplicado | Entrar con un usuario de prueba y ver el panel con la paleta del club |
| **M1 — Socios** | CRUD de socios, búsqueda, categorías | Socios de prueba cargados y buscables en el entorno de desarrollo |
| **M2 — Cuotas** | Crear período de cuotas y asignarlas a socios | Generar la cuota de un mes y verla en el estado de cuenta de cada socio |
| **M3 — Pagos** | Registro de pago con comprobante, aprobación | Subir un comprobante real, aprobarlo, y ver la cuota pasar a PAGADA |
| **M4 — Cobranza** | Morosidad, estado de cuenta, recordatorio | La directiva identifica al moroso más antiguo en menos de 10 segundos |
| **M5 — Cierre** | Gastos, reportes, configuración, **importación definitiva de los 54 socios en el PC de casa** | Reporte del mes cuadra contra la cartola del club |

## 6. Fuera de alcance del MVP

- Pasarela de pago en línea (Webpay, Khipu, MercadoPago). En el MVP el socio transfiere y adjunta el comprobante.
- Aplicación móvil nativa. El panel es web responsive.
- Lectura automática de comprobantes con IA.
- Multi-club o cuentas para otras organizaciones.
- Landing page pública del club (es la fase 2).
- Integración con contabilidad externa.

## 7. Flujo principal que debe funcionar

El MVP está terminado cuando este recorrido funciona de punta a punta:

1. El tesorero crea la cuota de noviembre con vencimiento el día 10.
2. El sistema asigna la cuota a los 50 socios activos.
3. Un socio transfiere a la cuenta del club y sube el comprobante.
4. Al tesorero le aparece el comprobante en la bandeja.
5. El tesorero lo revisa y lo aprueba.
6. La cuota del socio pasa a PAGADA y desaparece de morosidad.
7. Al día 15, morosidad muestra a los 8 socios que no pagaron.
8. El tesorero exporta la lista y les envía el recordatorio.

## 8. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Los datos del club están en Excel desordenado | M1 se atrasa | Revisar el Excel real antes de empezar; cargar en dos tandas |
| La tesorería cambia de persona | El sistema queda huérfano | Documentar el flujo en la wiki; dejar 2 usuarios con rol tesorero |
| El rojo de marca se confunde con error | Interfaz confusa | Paleta semántica separada, ya definida en la guía de marca |
| El club no tiene el logo en SVG | El logo se ve borroso en pantallas grandes | Pedir el vectorial; mientras, usar el WebP a 2× |
| Se construye de más | El MVP no termina | Todo lo que no esté en la sección 4 se rechaza y va a una lista de "después" |

## 9. Próximo paso

El stack está definido (D1). Arranca **M0**: crear el repositorio con los tres espacios de trabajo, conectar Drizzle contra la base de datos, montar Better Auth en Hono y dejar el tema del club aplicado sobre shadcn.

Antes de M1 conviene cerrar D2 a D6.

Los comandos concretos de M0 están en [`arquitectura.md`](arquitectura.md#comandos-del-primer-día-m0).
