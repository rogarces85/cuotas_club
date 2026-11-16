---
title: Contexto existente — base de datos y proyectos previos
type: context
status: verified
updated: 2026-11-16
---

# Contexto existente

Antes de escribir código se revisó la máquina. **El proyecto no parte de cero.**

## Base de datos ya creada

En la instancia MySQL de XAMPP existe la base `osorno_runners`.

- Motor real: **MariaDB 10.4.32** (no MySQL). Puerto 3306 activo.
- 18 tablas y 1 vista. Modelo completo.
- **54 socios cargados y reales.**
- Todo lo demás está vacío: 0 pagos, 0 usuarios, 0 niveles de cuota, 0 estados de cuota.

Es decir: el esquema está diseñado y los socios están cargados. **No hay historial de pagos que migrar.**

### Tablas encontradas

| Tabla | Filas | Para qué |
|---|---|---|
| `socios` | **54** | Padrón del club |
| `niveles_cuota` | 0 | Montos por tipo (ACTIVO, MEMBRESIA…) |
| `pagos` | 0 | Registro de pagos |
| `pago_meses` | 0 | Desglose por período `AAAA-MM` |
| `estado_cuotas_detalle` | 0 | Importación de estados de cuenta |
| `estado_cuotas_imports` | 0 | Cabecera de esas importaciones |
| `cuentas_bancarias` | 0 | Datos para transferir |
| `movimientos_bancarios` | 0 | Cartola |
| `egresos`, `categorias_egreso` | 0 | Salidas de caja |
| `gastos_fijos` | 0 | Recurrentes |
| `otros_ingresos` | 0 | Rifas, donaciones |
| `compras_club`, `compras_items` | 0 | Compras con detalle |
| `miembros`, `usuarios` | 0 | Acceso al sistema |
| `plantillas_correo` | 0 | Correos automáticos |
| `vw_saldos` | vista | Saldos calculados |

### Los datos de socios

| Dato | Observación |
|---|---|
| Cantidad | 54, todos con `activo = 1` |
| Estado | 41 `ACTIVO`, 13 `MEMBRESIA` |
| Años | Mezcla de 2025 y 2026 |
| RUT | Guardado **normalizado**: `17682512K`, `127556636`. Sin puntos, sin guion |
| Columnas | `id_socio`, `rut`, `nombre`, `anio`, `sexo`, `estado`, `activo`, `created_at`, `updated_at` |

El formato del RUT ya está decidido por los datos: sin puntos y sin guion, con la K en mayúscula.

## Proyectos previos en `htdocs/www`

| Carpeta | Qué es | Estado |
|---|---|---|
| `RunOsorno` | App Next.js con despliegue Cloudflare (`.open-next`, `.wrangler`), `db/`, `emails/`, `e2e/` | Intentó antes. Sin uso actual conocido |
| `OR` | App con 233 archivos TS/TSX, Tailwind, `specs/`, `venv/` | Otro intento |
| `RunOsorno_V2` | Espacio de planificación con rsc instalado, `specs/`, sin código | Solo documentación |
| `Cuotas_Club` | **Este proyecto** | Wiki y plan. Sin código aún |

Hay tres intentos anteriores. Eso es información, no un problema: significa que el club ya sabe qué quiere y que el riesgo real no es la tecnología, es volver a empezar sin cerrar.

## Lo que esto cambia en el plan

| Antes | Ahora |
|---|---|
| M1: "cargar 50 socios desde Excel" | M1: CRUD con socios de prueba. **La importación de los 54 va a M5**, en el PC de casa |
| Modelo de datos propuesto desde cero | **Adoptar el esquema existente**, que es más rico que la propuesta inicial |
| D2: identificar socio por RUT o email | **Resuelto por los datos:** RUT normalizado |
| Decisión de motor de base de datos | **Resuelto:** MariaDB de XAMPP, con la advertencia de versión |

## Advertencia sobre MariaDB 10.4

10.4 llegó al fin de su vida en junio de 2024. Drizzle Kit genera SQL pensado para MySQL 8. Hay dos caminos:

1. **Usar la base existente** y revisar cada migración a mano antes de aplicarla. Funciona, pero hay que mirar el SQL.
2. **Actualizar el motor** a MariaDB 11.x o MySQL 8, conservando el esquema y los 54 socios.

El camino 1 es el rápido. El 2 es el que no va a molestar en seis meses.

## Dónde se ejecuta: dos entornos

El proyecto se inició en este PC, pero **la ejecución definitiva será en el PC de casa** (el de posgrado). Eso ordena el trabajo.

| Entorno | Qué es | Qué se hace ahí |
|---|---|---|
| **Este PC** (desarrollo) | XAMPP con MariaDB 10.4.32. Base `osorno_runners` con los 54 socios | Todo el desarrollo: M0 a M4, con datos de prueba |
| **PC de casa** (posgrado) | Donde se ejecutará el sistema para el club | **M5:** importación definitiva de los 54 socios y puesta en marcha |

Consecuencia práctica: **la importación de datos se deja para el final**, no es parte del arranque.

- En M1 el sistema se prueba con socios de prueba. No hace falta la base real para construir el CRUD.
- El proceso de importación se documenta ahora y se ejecuta en M5, en el PC de casa, con la base real delante.
- Nada de lo que se construya en este PC depende de que la base de casa esté disponible.

La importación se escribirá como **script reproducible** (`scripts/importar-socios.ts`), no como pasos manuales. Así se puede correr dos veces: una en este PC para probar, otra en el PC de casa para la carga real.

Pendiente de confirmar: si la base del PC de casa es la misma `osorno_runners` o una copia con más datos. Se define en M5, antes de ejecutar la importación.

## Decidido

**D0 · Base nueva importando los socios.** Aceptado.

- Se crea la base **`osorno_runners_v2`** con el esquema nuevo.
- Los 54 socios se importan desde `osorno_runners.socios`.
- La base vieja **no se toca**. Queda como respaldo y como fuente de verdad hasta que la importación esté verificada.

**D6 · Permanecer en MariaDB 10.4.32.** Aceptado, con una obligación: revisar a mano el SQL de cada migración antes de aplicarlo. Ver [`arquitectura.md`](arquitectura.md#compatibilidad-con-mariadb-104).
