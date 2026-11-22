---
title: Cumpleaños — listado, antigüedad y saludo por correo
type: feature
status: done
updated: 2026-11-21
---
# Cumpleaños — listado, antigüedad y saludo por correo

## Intent

El club ya tiene el padrón cargado, pero la directiva felicitaba a mano y
dependía de acordarse de cada fecha. Este módulo lista los cumpleaños del mes
en curso, muestra la edad que cumple cada integrante y la antigüedad en el
club, y permite enviar un saludo por correo con la identidad y los datos de
contacto del club.

Además se cargó la plantilla real del club en la base definitiva: 71 socios,
con los datos disponibles al momento. Los datos incompletos quedan editables
desde el módulo Socios.

## Importación del padrón real

El archivo de origen `Demo Plantilla.xlsx` tenía 72 filas de datos. El
resultado en la base es **71 socios**:

| Situación | Cantidad | Detalle |
|---|---|---|
| Filas de origen | 72 | Hoja `Socios` |
| Importadas por la API | 69 | RUT, nombre, año, fecha de nacimiento, fecha de ingreso (si había), email y teléfono |
| Filas con RUT provisional | 2 | `SINRUT-072` y `SINRUT-073`, sin RUT ni email en el archivo |
| Fila duplicada descartada | 1 | Fila 24: mismo RUT, email y teléfono que la fila 18; se conservó la fila 18 |
| Corrección de RUT | 1 | Fila 55: el dígito verificador del archivo no correspondía; se corrigió antes de importar |
| Corrección de fecha | 1 | Fila 46: `6/12/0022` se interpretó como `2022-12-06` |

Estado de completitud al importar:

- **71/71** con fecha de nacimiento (los cumpleaños funcionan para todos).
- **69/71** con email (los dos provisionales no tienen).
- **59/71** con fecha de ingreso (12 sin dato; el saludo omite la antigüedad).
- **0/71** con sexo; el archivo venía sin esa columna.
- La dirección de todos es `prueba,osorno` (marcador del archivo); se puede
  editar socio por socio.
- Todas las cuentas quedan con `anio = 2026` y `activo = 1`.

Los dos RUT provisionales se pueden reemplazar por el RUT real desde Socios →
Editar. Mientras no se reemplacen, la API no los acepta en un PATCH, lo que
obliga a completar el dato antes de guardar otros cambios de esa ficha.

## Scope

**Adentro:**

- Módulo **Cumpleaños** en el sidebar, debajo de Socios.
- `GET /api/cumpleanos` — socios activos que cumplen años en el mes actual
  (opcional `?mes=AAAA-MM`), ordenados por día.
- Por cada fila: día, edad que cumple, fecha de ingreso, antigüedad calculada
  (años y meses), email, si hoy es su cumpleaños y si ya se le envió el saludo.
- `GET /api/cumpleanos/:id/preview` — correo renderizado (asunto, texto y
  HTML) antes de enviar.
- `POST /api/cumpleanos/:id/enviar` — envía el correo y registra el envío.
  No permite enviar sin email, a un socio inactivo, fuera de su mes de
  cumpleaños ni dos veces el mismo año.
- Tabla `felicitacion_cumpleanos` con clave única `(socio, año)`.
- Plantilla HTML y texto con la paleta del club, el nombre del socio, la edad,
  la antigüedad y los datos de contacto de `config_club`.
- Vista previa en la web dentro de un iframe con sandbox, botón para copiar el
  texto y aviso claro si el SMTP todavía no está configurado.
- Cuenta de correo: `MAIL_PASSWORD` (contraseña de aplicación de Gmail) en
  `api/.env`. Sin ella, la vista previa y la copia funcionan; el envío responde
  503 con un mensaje explicativo.

**Afuera (explícito):**

- Envío automático programado el día del cumpleaños. Hoy se envía con un botón
  desde la lista del mes; un cron queda para cuando la operación lo pida.
- Reenvío del mismo año. La clave única lo impide; si hiciera falta, se borra
  el registro o se agrega una acción administrativa.
- Adjuntar imágenes/logo al correo. Se usa la identidad tipográfica y los
  colores; no se envían imágenes externas para no afectar la entregabilidad.
- Editar socios desde la pantalla de cumpleaños. La edición sigue en Socios.
- Cumpleaños de socios inactivos: se excluyen.

## Cálculos

- **Edad que cumple**: año del cumpleaños menos año de nacimiento.
- **Antigüedad**: diferencia calendario entre `fecha_ingreso` y hoy; si todavía
  no llega el día del mes, no se cuenta ese mes. Texto:
  `X años y Y meses`, `X años`, `Y meses` o `menos de un mes`.
- **Hoy**: se compara día y mes en la zona local del servidor. El correo dice
  "Hoy cumples…" solo si coincide el día; si no, "Este mes cumples…".

## Email

- Asunto: `¡Feliz cumpleaños, {nombre}! · {club}`.
- Cuerpo: saludo por el primer nombre, edad, antigüedad, frase de cierre y
  datos del club (nombre, email, teléfono y dirección configurados).
- HTML de una columna, con tabla y estilos inline, sin JavaScript ni imágenes.
  Se escapan los datos personales y del club antes de insertarlos.
- El correo sale desde `MAIL_FROM` con la configuración SMTP existente.

## Checklist

- [x] T1 — Tabla `felicitacion_cumpleanos` + migración `0005_stormy_forge.sql` (leída y aplicada en la base principal y de test).
- [x] T2 — Cálculo de edad, antigüedad, período y “hoy” (`api/src/cumpleanos/calculo.ts`).
- [x] T3 — Plantilla de correo HTML/texto con escape y datos del club (`plantilla.ts`).
- [x] T4 — Rutas `/api/cumpleanos` con listado, preview, envío, deduplicación y errores claros.
- [x] T5 — Página Cumpleaños con tarjetas, contadores, vista previa, copia y envío.
- [x] T6 — Navegación del sidebar y `App.tsx` (`cumpleanos`).
- [x] T7 — Importación de la plantilla real y regularización de datos.
- [x] T8 — Tests: 71/71; verificación API 14/14; E2E UI 7/7; navegación 11/11.
- [x] T9 — Documentación y README.

## Evidence

- **Migración** — `api/drizzle/0005_stormy_forge.sql`: tabla
  `felicitacion_cumpleanos` con `UNIQUE(id_socio, anio)`. Aplicada en
  `osorno_runners_v2` y `osorno_runners_v2_test`.
- **Datos** — 71 socios en la base principal; 71 con fecha de nacimiento; 5
  cumpleaños en noviembre de 2026; el listado devuelve día, edad y antigüedad
  (por ejemplo, 52 años, 10 años y 8 meses para un ingreso de 2016).
- **Tests** — `npm test -w api` → **71/71**. Incluye cálculos de antigüedad
  (bordes de día/mes), plantilla y escape de HTML, y 401 de las tres rutas.
- **API** — `node api/scripts/verify-cumpleanos.mjs` → **14/14**: listado con
  socios sembrados, edad/antigüedad, preview, 400 sin correo, 503 sin SMTP,
  no registra envíos fallidos, 409 duplicado, 401 sin sesión.
- **UI** — `node api/scripts/e2e-cumpleanos-ui.mjs` → **7/7**: abre la sección,
  muestra mes y contadores, lista tarjetas, abre la vista previa, iframe y
  botón de copia. No envía correos reales.
- **Navegación** — `npm run verify:nav` y `node web/scripts/e2e-nav.mjs` →
  Cumpleaños abre con su título.
- **Calidad** — typecheck y build de los tres workspaces en 0.

## Next

- Agregar `MAIL_PASSWORD` (contraseña de aplicación de Google, con 2FA) en
  `api/.env` y reiniciar la API para habilitar el botón de envío.
- Completar en Socios los datos faltantes: sexo, direcciones reales, las dos
  filas sin RUT y las 12 fechas de ingreso.
- Opcional: programar el envío el día del cumpleaños y agregar reenvío
  administrativo.
