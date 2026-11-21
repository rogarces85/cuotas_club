---
title: Socios — campos nuevos, direcciones y carga masiva
type: feature
status: done
updated: 2026-11-21
---
# Socios — campos nuevos, direcciones y carga masiva

## Intent

Completar el padrón con la información que el club necesita para categorizar y
contactar a sus integrantes, y resolver la carga inicial de decenas de socios sin
escribirlos uno por uno.

El alta existente solo guardaba RUT, nombre, año, un sexo de texto libre y
contacto. Faltaba la fecha de nacimiento (categorías por edad), la fecha de
ingreso (antigüedad), una dirección válida y una forma segura de cargar el
padrón completo desde una planilla.

## Scope

**Adentro:**

- Campos nuevos en `socio`: `fecha_nacimiento`, `fecha_ingreso`, `direccion`.
  Migración `0004_dear_wendell_rand.sql` (tres columnas nullable).
- `sexo` pasa a catálogo cerrado en la capa de validación:
  `HOMBRE | MUJER | INDEFINIDO` (se muestra Hombre / Mujer / Indefinido).
- Fechas validadas como fechas reales, no futuras y con piso razonable
  (nacimiento 1900, ingreso 1950). Se guardan como `date` y viajan como
  `AAAA-MM-DD`.
- Validación de direcciones con Google Geocoding si existe
  `GOOGLE_MAPS_API_KEY`; si no, OpenStreetMap/Nominatim. Endpoint
  `GET /api/geocoding/buscar?q=…` con caché de 24 h y límite de 1 req/s a
  Nominatim. Nunca bloquea el guardado: si el proveedor falla, se avisa y la
  dirección se puede guardar igual.
- Modal de alta/edición rediseñado con la paleta del club: cabecera con acento
  rojo, secciones Identificación / Datos personales / Contacto / Membresía,
  obligatorios marcados con `*`, foco rojo, y un ejemplo debajo de cada campo.
  La dirección tiene autocompletado con sugerencias y estado "validada".
- Importación masiva desde el módulo Socios:
  - `GET /api/socios/plantilla` → Excel limpio con hojas **Socios**,
    **Ejemplos** e **Instrucciones**.
  - `POST /api/socios/importar` → acepta `.xlsx`, `.xls` y `.csv`; valida y
    previsualiza con `dryRun=true` antes de escribir; `force=true` actualiza
    socios existentes sin borrar celdas vacías.
  - Todo se escribe en una transacción: si algo falla, el padrón queda como
    estaba.
  - Modal de carga con descarga de plantilla, arrastrar/soltar, resumen previo
    (nuevas / actualizan / omiten / errores) y lista de errores por fila.
- Tabla de socios con Sexo e Ingreso; ficha con nacimiento (y edad), ingreso,
  dirección enlazada a Google Maps, email y teléfono.
- La importación duplicada de Configuración se retiró: la carga vive en Socios.
  El endpoint heredado `POST /api/config/importar/socios` se mantiene como
  alias del nuevo importador.

**Afuera (explícito):**

- Guardar latitud/longitud o pintar un mapa. La validación confirma que la
  dirección existe; no se almacena geocodificación.
- La clave de Google es opcional y la provee el club. Sin clave se usa
  OpenStreetMap, que no requiere registro.
- Roles por operación. Sigue bastando una sesión válida.
- Limpieza/transformación de los datos históricos de los 54 socios: la
  plantilla es el mecanismo, la carga real la hace la tesorería.

## Contrato de la plantilla

| Columna | Obligatoria | Formato / nota |
|---|---|---|
| `rut` | Sí | 7-8 dígitos + DV. Se limpia solo (puntos y guion) y se valida módulo 11. |
| `nombre` | Sí | Nombre y apellido, 2-160 caracteres. |
| `anio` | Sí | Año de la membresía que se cobra (2020-2100). |
| `sexo` | No | Hombre / Mujer / Indefinido (acepta H, F, X, Masculino, Femenino). Vacío = sin dato. |
| `fecha_nacimiento` | No | `AAAA-MM-DD`, `DD-MM-AAAA` o celda de fecha de Excel. |
| `fecha_ingreso` | No | Igual que la anterior. |
| `direccion` | No | Máximo 255 caracteres. |
| `email` | No | Correo válido; se normaliza a minúsculas. |
| `telefono` | No | Máximo 30 caracteres. |
| `estado` | No | ACTIVO / MEMBRESIA / BECADO. Vacío = ACTIVO. |
| `activo` | No | 1 vigente / 0 baja. Vacío = 1. |

La importación detecta RUT repetidos dentro del archivo, RUT inválidos, sexo
fuera del catálogo, fechas imposibles/futuras y columnas obligatorias faltantes.
Cada error indica el número de fila.

## Checklist

- [x] T1 — Esquema + migración `0004` (leída antes de aplicar) y migración de la base de test.
- [x] T2 — Validadores compartidos: sexo cerrado, fechas reales/no futuras, dirección, DTOs.
- [x] T3 — Repo/rutas de socios con los campos nuevos; alta y edición probadas contra MariaDB.
- [x] T4 — Plantilla Excel generada en el servidor y endpoint de importación transaccional con `dryRun`.
- [x] T5 — Proxy de direcciones (Google/Nominatim) con caché, timeout y degradación sin bloquear el alta.
- [x] T6 — Modal modernizado con paleta del club, selects, fechas y ejemplos por campo.
- [x] T7 — Importación masiva en SociosPage con descarga, drag & drop, preview y errores.
- [x] T8 — Tabla (incluye edad derivada) y ficha con los datos nuevos.
- [x] T9 — `npm test` (52), typecheck/build de los tres workspaces.
- [x] T10 — Verificación API 15/15 y E2E de UI 13/13 con capturas.

## Evidence

- **Migración** — `api/drizzle/0004_dear_wendell_rand.sql`:
  `ALTER TABLE socio ADD fecha_nacimiento date`, `ADD fecha_ingreso date`,
  `ADD direccion varchar(255)`. Aplicada en `osorno_runners_v2` y en
  `osorno_runners_v2_test`. Columnas verificadas con `SHOW COLUMNS FROM socio`.
- **Tests** — `npm test -w api` → **52 passed / 52**. Incluye
  `api/src/socios/import.test.ts`: RUT módulo 11, fechas ISO/chilenas/serial
  Excel, plantilla de 3 hojas, encabezados con acentos, duplicados, CSV con `;`.
- **API** — `node api/scripts/verify-socios-import.mjs` → **15/15**:
  plantilla 24 KB, alta con fechas/dirección, sexo inválido 400, fecha futura
  400, dry-run sin escribir, importación real 1 insertado + 1 actualizado +
  2 errores, celdas vacías que no borran, geocodificación con sugerencias.
- **UI** — `node api/scripts/e2e-socios-form.mjs` → **13/13** (Chrome headless
  vía CDP): modal con secciones y ejemplos, select Hombre/Mujer/Indefinido,
  fechas y dirección presentes, sugerencias de dirección, estado "validada",
  alta visible en tabla con edad derivada, ficha con nacimiento/ingreso/
  dirección, preview de importación, importación desde la UI y fila importada
  en el padrón. Capturas en `02-DOCS/preview/socios-*.png`.
- **Calidad** — `npm run typecheck` (3 workspaces) y `npm run build` (3
  workspaces) en 0 errores.

## Next

- Pedir al club una clave de Google Geocoding si quiere direcciones más exactas
  que OpenStreetMap (el sistema funciona sin ella). El espacio ya está en
  `api/.env` como `GOOGLE_MAPS_API_KEY=`.
- Cargar el padrón real con la plantilla y revisar los errores por fila antes
  de confirmar. La tabla ya muestra la edad derivada de la fecha de nacimiento;
  la ficha muestra la fecha completa.
