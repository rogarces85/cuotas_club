---
author: Rodrigo Garces
branch: main
status: in-progress
---
# M4 — Cobranza (comprobantes, cartola, correos)

## Intent

Cerrar el flujo principal de cobranza: que el socio pueda subir el comprobante de transferencia, que el tesorero lo vea en la bandeja (M3), lo apruebe/rechace, y se notifique por correo. Además, importar la cartola bancaria para conciliar pagos automáticamente.

## Scope

**Adentro:**

- **POST /api/pagos/:id/comprobante** — subir comprobante (multipart, validar MIME/tamaño/SHA256)
- **GET /api/comprobantes/:id** — servir archivo privado (autenticación + autorización: dueño o tesorero)
- **PATCH /api/comprobantes/:id** — actualizar estado (PENDIENTE/APROBADO/RECHAZADO)
- **GET /api/pagos/:id/comprobante** — endpoint helper para obtener comprobante del pago
- **POST /api/bancos/importar** — importar CSV/Excel de cartola → `movimiento_bancario`
- **GET /api/bancos/movimientos** — listar movimientos importados
- **POST /api/bancos/conciliar** — sugerir/matchear movimientos a pagos pendientes
- **Envío de correo** al aprobar/rechazar (D5: `tesoreriaor@gmail.com` vía Gmail SMTP)
- **Página Pagos** (M3): botón "Subir comprobante" en estado PENDIENTE, visor PDF/imagen
- **Página Bancos**: importar cartola, ver movimientos, conciliar

**Afuera (explicitado):**

- OCR/IA para leer comprobantes — fuera de alcance
- Pasarela de pago en línea (Webpay, Khipu) — fuera de alcance (MVP: transferencia + adjunto)
- Multi-banco automático — fuera de alcance (importación manual CSV/Excel)

## Checklist

- [x] T1 — FTD document (este archivo)
- [x] T2 — API: rutas de comprobantes (subida, descarga privada, actualización estado) — `api/src/upload/routes.ts`, `api/src/pagos/routes.ts`, `api/src/pagos/repo.ts`
- [x] T3 — API: cuentas bancarias (CRUD) + importación cartola + conciliación — `api/src/bancos/routes.ts`
- [x] T4 — API: envío de correo al aprobar/rechazar (SMTP Gmail) — `api/src/mailer.ts`, integrado en `aprobarPago`/`rechazarPago`
- [x] T5 — Frontend: subida de comprobante en PagosPage + visor — `web/src/pages/PagosPage.tsx`, `web/src/lib/api.ts`
- [x] T6 — Frontend: página Bancos (cuentas, importar cartola, conciliar) — `web/src/pages/BancosPage.tsx`, `web/src/lib/api.ts`, `Shell.tsx`, `App.tsx`
- [ ] T7 — Prueba de aceptación E2E (subir comprobante → aprobar → correo enviado)

## Evidence

(se va completando por tarea)

## Decisiones técnicas

- Archivos: almacenados en `api/uploads/comprobantes/<sha256><ext>`; ruta guardada en BD
- Validación MIME: `application/pdf`, `image/png`, `image/jpeg`; máx 5 MB
- SHA256 calculado en servidor para deduplicar y validar integridad
- Correos: plantillas simples en texto plano; SMTP con contraseña de aplicación de Google
- Conciliación: match por monto exacto + RUT en descripción + ventana de ±2 días

## Next

T2 — API: crear rutas de comprobantes (subida multipart, validación, almacenamiento, descarga autenticada).