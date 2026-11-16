---
title: Análisis de referencia — Zenith Dashboard (shadcn)
type: reference
status: analyzed
updated: 2026-11-16
---

# Análisis de referencia — Zenith Dashboard

Fuente: https://zenith-shadcn.dashboardpack.com/dashboard
Método: descarga del HTML servido y de sus hojas de estilo, extracción de la estructura de navegación, widgets del panel y tokens de tema. Las subpáginas (socios, facturas, pedidos) se renderizan en el cliente, así que se documenta su existencia y su patrón, no su contenido interno.

## Qué es

Plantilla de dashboard hecha con Next.js, Tailwind v4 y shadcn/ui. Es una aplicación de administración genérica de e-commerce y SaaS. Trae 22 pantallas y un panel con seis bloques de datos.

## Estructura de la aplicación

**Shell:**

- Sidebar colapsable con 5 grupos de navegación.
- Topbar con marca, botón primario de acción rápida ("New Order"), paleta de comandos `⌘K` y menú de usuario.
- Tema claro y oscuro (clase `.dark`, 118 reglas).
- Tipografía Geist Sans + Geist Mono.

**Navegación completa:**

| Grupo | Destinos |
|---|---|
| Overview | Dashboard, Analytics, eCommerce, CRM, SaaS, Charts |
| Commerce | Orders (badge 12), Products, Customers, Invoices |
| Apps | Mail, Chat, Files, Kanban, Calendar, Wizard, Forms |
| Finance | Billing |
| System | Users, Notifications (badge 3), Settings, Help & Support |

## El panel, bloque por bloque

| # | Bloque | Qué trae | ¿Nos sirve? |
|---|---|---|---|
| 1 | Fila de 4 KPI cards | Total Revenue, Active Users, Total Orders, Page Views, con variación | **Sí**, adaptado a cuotas |
| 2 | Gráfico de área | "Monthly performance for the current year", series Revenue / Orders / Profit con leyenda conmutables | **Sí**, recaudación mensual |
| 3 | Donut de origen | "Traffic Sources": Visits, Direct, Organic, Referral, Social | **Sí**, como estado de los pagos |
| 4 | Metas | "Monthly Goals" con barras de progreso y Target | **Sí**, meta de recaudación |
| 5 | Tabla reciente | "Recent Orders": Customer, Order ID, Product, Status, Amount, Actions + "View all" | **Sí**, es el corazón del sistema |
| 6 | Feed de actividad | "Recent Activity" con eventos y marcas de tiempo | **Sí**, pero después del MVP |

## Tokens del tema (lo más valioso)

Zenith usa el juego estándar de shadcn en OKLCH. Esto permite reemplazar los colores sin tocar los componentes:

`--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--success`, `--warning`, `--border`, `--input`, `--ring`, `--chart-1..5`, `--sidebar-*` (8 tokens), `--radius`.

Sus valores son neutros (grises puros, croma 0). El rojo aparece solo como `--destructive` y en `--chart-1`. Eso confirma que la paleta del club entra limpiamente: cambiamos los neutros por negro/blanco y el rojo pasa a `--primary`.

## Qué adoptamos

1. **El shell:** sidebar agrupado + topbar + `⌘K`. Es el patrón que el club va a reconocer como "sistema de verdad".
2. **La grilla del panel:** 4 KPI arriba, gráfico ancho, columna lateral con donut y metas, tabla abajo. Funciona y no hay que inventarla.
3. **La tabla con acciones por fila** y el patrón "Ver todo".
4. **Los tokens shadcn**, para que el tema del club sea un archivo de CSS y no una cirugía por componente.
5. **Tema claro/oscuro.** El club entrena de noche; el modo oscuro con sidebar negra se siente nativo.
6. **El sistema de badges de conteo** en la navegación (12 pagos por revisar, 3 avisos).

## Qué descartamos

| Pantalla | Por qué no |
|---|---|
| Products, eCommerce, Orders | No vendemos productos |
| Mail, Chat, Files | Fuera de alcance del MVP |
| Kanban, Calendar, Wizard | Sin uso para cobranza |
| CRM, SaaS, Analytics | Métricas de negocio que no aplican a un club |
| Billing | El club no se suscribe a sí mismo |
| Charts (galería) | Es una página de demostración, no una pantalla |

## Mapa de pantallas para Osorno Runners

Traducción del patrón, no copia de las pantallas:

| Zenith | Osorno Runners | Prioridad |
|---|---|---|
| Dashboard | **Panel** — KPIs, recaudación, morosidad, últimos pagos | MVP |
| — | **Cuotas** — períodos, montos, vencimientos, activar/pausar | MVP |
| Orders | **Pagos y comprobantes** — bandeja de revisión, aprobar/rechazar | MVP |
| Customers | **Socios** — ficha, categoría, apoderados | MVP |
| Invoices | **Estado de cuenta** por socio | MVP |
| — | **Morosidad** — quién debe y desde cuándo | MVP |
| — | **Cuentas bancarias** — datos para transferir | MVP |
| Billing | **Gastos e ingresos extra** | Fase 1.5 |
| — | **Reportes** — balance, exportar | Fase 1.5 |
| Settings | **Configuración** del club | MVP |
| Users | **Usuarios y roles** (directiva / tesorero / socio) | MVP |
| Notifications | Avisos de pagos por revisar | Fase 1.5 |
| Help & Support | Ayuda | Fase 2 |

## Cómo se ve con la paleta del club

- Sidebar `#0A0A0A` con texto `#FAFAFA` e ítem activo con barra roja `#DF022F`.
- Fondo blanco, tarjetas blancas con borde `#E7E7E7`.
- Botón primario rojo con texto blanco (5.02:1, AA).
- KPIs: el número en negro; el que exige acción (morosidad) en rojo.
- Gráfico de recaudación: serie principal roja, serie de referencia negra.
- Donut de estados: esmeralda (pagado), ámbar (pendiente), rojo profundo (vencido).
- Tabla con filas alternadas casi imperceptibles. El estado va en badge, no en el color de la fila.

## Riesgo identificado

El rojo es color de marca **y** tradicionalmente color de error. En este sistema hay que separarlos o la interfaz va a gritar en todas partes. Resuelto en `marca-y-paleta.md`: el rojo de marca es `#DF022F`, el de error es `#7A0015` con ícono y texto, y jamás se usa rojo como adorno.
