---
title: Marca y paleta — Osorno Runners
type: brand
status: active
updated: 2026-11-16
---

# Marca y paleta — Osorno Runners

## Identidad

| Dato | Valor |
|---|---|
| Nombre del club | Osorno Runners |
| Producto | Sistema de gestión de cuotas (dashboard interno) |
| Paleta oficial | Rojo, negro y blanco |
| Logo | `02-DOCS/attachments/brand/logo-osorno-runners.webp` (1446×756, fondo transparente) |

El logo tiene dos piezas: el monograma **"OR"** (rojo con contorno blanco, la "O" con estelas de movimiento) y el wordmark **"OSORNO RUNNERS"** en itálica condensada. El archivo viene con transparencia real (canal alfa medido), así que se puede montar sobre blanco o negro sin recortes.

## Colores medidos

Los valores salen de analizar los píxeles del archivo del logo, no de una estimación visual:

| Color | Hex | OKLCH | Uso |
|---|---|---|---|
| Rojo Osorno Runners | `#DF022F` | `oklch(57.1% 0.2296 22.8)` | Acento de marca (57.1% de luminosidad) |
| Negro | `#000000` | `oklch(0% 0 0)` | Base oscura, sidebar, texto |
| Blanco | `#FFFFFF` | `oklch(100% 0 0)` | Superficies, texto sobre rojo |

El rojo medido aparece en el logo en `#DF022F` (modo exacto, 40.409 px) con promedio `#DC0935` en toda la familia roja.

### Contraste verificado

| Combinación | Ratio | Veredicto |
|---|---|---|
| Blanco sobre rojo | **5.02:1** | AA para texto normal ✓ |
| Rojo sobre blanco | **5.02:1** | AA para texto normal ✓ |
| Negro sobre rojo | 4.19:1 | **Falla AA** para texto normal ✗ |

**Regla:** sobre rojo siempre va texto blanco. Nunca texto negro.

## Escala roja (tono 22.8 constante)

Generada en OKLCH para no torcer el tono hacia magenta al aclarar u oscurecer:

| Token | Hex | OKLCH |
|---|---|---|
| `red-50` | `#FDF0EF` | `oklch(96.5% 0.0140 22.8)` |
| `red-100` | `#FDE0DE` | `oklch(93.0% 0.0320 22.8)` |
| `red-200` | `#FECBC7` | `oklch(88.5% 0.0580 22.8)` |
| `red-300` | `#FAA39E` | `oklch(80.0% 0.1050 22.8)` |
| `red-400` | `#F36162` | `oklch(68.0% 0.1800 22.8)` |
| **`red-500`** | **`#DF022F`** | **`oklch(57.1% 0.2296 22.8)`** ← marca |
| `red-600` | `#BE0026` | `oklch(50.5% 0.2040 22.8)` |
| `red-700` | `#9B001D` | `oklch(43.5% 0.1760 22.8)` |
| `red-800` | `#7A0015` | `oklch(36.5% 0.1480 22.8)` |
| `red-900` | `#63000F` | `oklch(31.5% 0.1270 22.8)` |
| `red-950` | `#480209` | `oklch(25.5% 0.1000 22.8)` |

## Dirección visual

**Sidebar negro, contenido blanco, rojo solo como acento.** El negro da el peso de club deportivo y hace que el rojo del logo resalte sin competir. El blanco mantiene las tablas y montos legibles.

Proporción 60/30/10:

- **60%** blanco y neutros claros: fondo, tablas, formularios.
- **30%** negro: sidebar, texto principal, encabezados.
- **10%** rojo: botón primario, totales destacados, estado activo, badge de morosidad.

El rojo no se usa para decorar. Solo para acciones y datos que exigen atención.

## Colores de estado (excepción documentada)

Como el rojo es color de marca, no puede además significar "error". Se reserva una paleta semántica mínima, solo para estados de pago:

| Estado | Color | Hex | Nota |
|---|---|---|---|
| Pagado / aprobado | Esmeralda | `#059669` | Fuera de la paleta de marca, por semántica |
| Pendiente | Ámbar | `#D97706` | |
| Rechazado / vencido | Rojo profundo | `#7A0015` | Distinto del rojo de marca `#DF022F`, siempre con ícono y texto |

Ningún estado se comunica solo por color. Siempre lleva ícono y etiqueta.

## Tokens para el sistema (shadcn)

La referencia Zenith usa el juego estándar de tokens shadcn en OKLCH. Estos son los mismos tokens, con la paleta del club aplicada.

```css
:root {
  --radius: 0.625rem;

  --background: #FFFFFF;
  --foreground: #0A0A0A;

  --card: #FFFFFF;
  --card-foreground: #0A0A0A;
  --popover: #FFFFFF;
  --popover-foreground: #0A0A0A;

  /* Rojo del club como color de acción */
  --primary: #DF022F;
  --primary-foreground: #FFFFFF;

  --secondary: #F5F5F5;
  --secondary-foreground: #1A1A1A;

  --muted: #F5F5F5;
  --muted-foreground: #6B6B6B;

  /* Tinte rojo para hover y selección */
  --accent: #FDF0EF;
  --accent-foreground: #9B001D;

  --destructive: #7A0015;
  --destructive-foreground: #FFFFFF;

  --success: #059669;
  --success-foreground: #FFFFFF;
  --warning: #D97706;
  --warning-foreground: #FFFFFF;

  --border: #E7E7E7;
  --input: #E7E7E7;
  --ring: #DF022F;

  /* Gráficos: rojo primero, luego neutros */
  --chart-1: #DF022F;
  --chart-2: #0A0A0A;
  --chart-3: #6B6B6B;
  --chart-4: #F36162;
  --chart-5: #BE0026;

  /* Sidebar negra: el ancla visual del club */
  --sidebar: #0A0A0A;
  --sidebar-foreground: #FAFAFA;
  --sidebar-primary: #DF022F;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: #1F1F1F;
  --sidebar-accent-foreground: #FFFFFF;
  --sidebar-border: #262626;
  --sidebar-ring: #DF022F;
}

.dark {
  --background: #0A0A0A;
  --foreground: #FAFAFA;

  --card: #141414;
  --card-foreground: #FAFAFA;
  --popover: #171717;
  --popover-foreground: #FAFAFA;

  --primary: #DF022F;
  --primary-foreground: #FFFFFF;

  --secondary: #1F1F1F;
  --secondary-foreground: #FAFAFA;

  --muted: #1F1F1F;
  --muted-foreground: #A3A3A3;

  --accent: #1F1F1F;
  --accent-foreground: #FAFAFA;

  --destructive: #F36162;
  --destructive-foreground: #0A0A0A;

  --success: #34D399;
  --success-foreground: #0A0A0A;
  --warning: #FBBF24;
  --warning-foreground: #0A0A0A;

  --border: #262626;
  --input: #262626;
  --ring: #DF022F;

  --chart-1: #DF022F;
  --chart-2: #FAFAFA;
  --chart-3: #A3A3A3;
  --chart-4: #F36162;
  --chart-5: #BE0026;

  --sidebar: #000000;
  --sidebar-foreground: #FAFAFA;
  --sidebar-primary: #DF022F;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: #1F1F1F;
  --sidebar-accent-foreground: #FAFAFA;
  --sidebar-border: #262626;
  --sidebar-ring: #DF022F;
}
```

## Tipografía

| Rol | Fuente | Motivo |
|---|---|---|
| UI y datos | **Geist Sans** | La misma que usa Zenith. Neutra, buena en tablas y números |
| Cifras y códigos | **Geist Mono** | Montos alineados, números de comprobante |
| Wordmark | La del logo, ya vectorizada | No recrear con una fuente del sistema |

El wordmark es itálica condensada. No se usa como fuente de interfaz. Los títulos de pantalla van en Geist Sans semibold.

## Uso del logo

- **Fondo blanco:** versión a color (como está). Es la presentación más fiel.
- **Fondo negro:** verificado en el render de la vista previa. Funciona, pero el contorno blanco es lo único que separa el monograma, así que la "R" se lee hueca. Si el club tiene una **versión negativa** (la "R" en blanco), es la que corresponde para la sidebar. Pedirla junto con el SVG.
- **Sobre rojo:** no usar. El rojo del logo se pierde.
- **Espacio libre:** mínimo igual a la altura de la "R" alrededor de toda la pieza.
- **Tamaño mínimo:** 120 px de ancho en pantalla. Bajo eso, usar solo el monograma.
- **Formatos:** pedir SVG al club para la app y la landing. Mientras no exista, usar el WebP a 2×.

Pendiente con el club:

| Ítem | Para qué |
|---|---|
| Logo en SVG o AI | Escalar sin pérdida en la app y la landing |
| Versión negativa (R en blanco) | Sidebar negra y piezas sobre fondo oscuro |
| Versión monocroma blanca | Estampados y usos de una tinta |

## Vista previa

`../../preview/panel-osorno-runners.html` — panel del sistema con la paleta aplicada, sin frameworks ni dependencias. Abrir con doble clic o servirla desde XAMPP. Datos de ejemplo.

## Accesibilidad

- Todo texto cumple AA sobre su fondo.
- El foco visible usa `--ring` rojo con 2 px de grosor.
- Los estados nunca dependen solo del color.
- Verificar contraste con la herramienta del navegador antes de cerrar cada pantalla.
