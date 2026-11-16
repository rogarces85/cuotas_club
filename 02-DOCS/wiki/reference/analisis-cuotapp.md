# Análisis REA — www.cuotapp.cl

**Fecha:** 2026-11-16 · **Método:** REA (Reverse Engineer Anything) sobre artefactos desplegados del frontend
**Objetivo:** caracterizar el sistema para replicar/adaptar sus capacidades en un Club Deportivo.

## Evidencia REA

| Evidence ID | Alcance | Estado |
|---|---|---|
| `ev_b024e5cc9e757b674e1cd5f9ca646d912b743050a1384237889ef9bfb9f8a72b` | 12 módulos de lógica (servicios API, stores, flujos de pago) | completo — 213 hallazgos |
| `ev_22aec438dc56e0b47f8a9596f7f20b4f6279b9cb6b51ee8d45a46b633ebcb7b3` | Bundle principal (350 KB minificado) | parcial (timeout del proveedor semántico) |

Artifacts locales: `rea_analysis/index.html`, `rea_analysis/assets/*.js` (90 chunks), `rea_analysis/rea_core_evidence.json`.

**Limitaciones (de la propia evidencia):** análisis estático; JavaScript/HTML parseados como texto inerte. No se ejecutó el backend ni el frontend; los endpoints son candidatos derivados de sintaxis, no observación de ejecución. La cobertura del grafo es parcial; los hechos no disponibles quedan explícitos y no deben leerse como ausencia.

## 1. Qué es Cuotapp

SaaS chileno (es-CL) para tesoreros de juntas de vecinos, clubes deportivos, cursos escolares y comunidades. Propuesta de valor observada en su propia landing:

- El club define **cuotas/cobros** (obligaciones) con montos y vencimientos.
- Los miembros **transfieren a la cuenta bancaria del club** y adjuntan el **comprobante** desde su celular.
- El tesorero **valida en 1 clic** con visor de comprobantes (zoom/rotar) y ayuda de **IA** que lee monto, fecha y cuenta destino ("IA: Datos Coinciden").
- El sistema genera **recibo automático por email** con código de seguimiento.
- Cuentas separadas para **fondos especiales** (rifas, donaciones, kermesses) y **egresos con boletas de respaldo**.
- Transparencia: reportes de balance visibles (u ocultos) para los miembros.

## 2. Arquitectura observada

- **Frontend:** SPA React + Vite (90 chunks con code-splitting), React Router, Zustand (`useOrgStore`, `usePeriodStore`), Tailwind CSS, validación con Zod + react-hook-form (`schemas-V1X-Q1Aq.js`), exportación Excel con SheetJS (`xlsx-Cr3PltXQ.js`), axios.
- **Backend REST:** `https://api.cuotapp.cl/api/v1` (implementación del backend **no observada**).
- **Auth:** JWT Bearer guardado en `localStorage` (`token`, `user`); interceptor axios: agrega `Authorization: Bearer`, en 401 limpia sesión y redirige a `/login`. Login con Google (`/auth/google`), verificación por código, refresh, recuperación/reset de contraseña.
- **Roles:** `ADMIN` (portal `/admin`) y `MEMBER` (portal `/member`).
- **Pagos del plan de suscripción:** Transbank Webpay Plus, Khipu y Flow.
- **IA:** endpoint `/assistant/chat` (copiloto financiero) + evaluación automática de comprobantes.
- **Analítica:** Google Analytics (`G-LBJ4GQ52GN`).

## 3. Modelo de dominio (entidades y estados)

| Entidad | Datos / comportamiento observado |
|---|---|
| **Organization** | CRUD; `publicToken` regenerable → enlace público de pago `/p/:orgToken`; `reportsVisibleToMembers`; admins con invitación |
| **Participant** | socio/alumno/apoderado; **multi-apoderado** (varios tutores por participante); `claimCode` para auto-asociación; `shareAccess` por email; `unlink`; sugerencias por RUT (`rutUtils`) |
| **Obligation (cobro)** | nombre ("Mensualidades 2026", "Cuota Extraordinaria"), genera **detalles/cuotas** (máx. 12, monto > 0, vencimientos ajustables), estados `ACTIVE`/`PAUSED`, filtro por año |
| **Payment** | por `obligationDetailId`; método `TRANSFER`; `amountPaid` (abonos parciales), `documentUrl` (comprobante), `paymentDate`, referencia; ciclo `pending → approve/reject`; creación individual o **batch**; consulta `pending` y `unpaid` (morosidad) |
| **BankAccount** | titular, banco (ej. Banco Estado), tipo `CORRIENTE`/`VISTA`/`AHORRO`, número, RUT, email; copiable al portapapeles para el pago |
| **Label** | etiquetas para clasificar cobros/gastos |
| **ExtraIncome** | ingresos extra (rifas, donaciones) separados de cuotas |
| **Expenses** | egresos con boleta de respaldo (plan Básico+) |
| **Report** | balance anual, evolución mensual, ingresos/egresos/ingresos extra, total de participantes, descarga PDF, exportación Excel |
| **Subscription** | planes, estado por organización, checkout, comprobante de transacción |

## 4. API REST observada (`/api/v1`)

```
Auth        POST /auth/register | /auth/register/invite/{orgId} | /auth/login | /auth/google
            POST /auth/join-org/{code} | /auth/refresh | /auth/verify-code
            POST /auth/forgot-password | /auth/reset-password
Organiz.    GET|POST /organizations ; GET|PUT|DELETE /organizations/{id}
            POST /organizations/{id}/public-token/regenerate
            POST /organizations/admins/accept-invite
Particip.   CRUD /organizations/{id}/participants (+ /bulk) ; DELETE .../participants/{id}/link
            GET  /organizations/{id}/my-participant ; GET .../participants/my-participants
            POST /organizations/{id}/my-participant | .../participants/claim
            POST .../participants/{id}/share ; DELETE .../participants/{id}/unlink-me
            GET  /participants/suggested
Obligac.    CRUD /organizations/{id}/obligations(?year) ; PATCH .../activate | .../pause
            GET  .../obligations/{id}/statuses ; PATCH .../details/{detailId}
Pagos       GET  /payments(?organizationId) | /payments/pending | /payments/unpaid
            GET  /payments/{id} | /payments/detail/{detailId} | /payments/by-obligation/{id}
            POST /payments | /payments/batch ; PUT /payments/{id} (pendiente)
            DELETE /payments/{id} (cancelar pendiente)
            PATCH /payments/{id}/approve | /payments/{id}/reject
Ctas. banco CRUD /organizations/{id}/bank-accounts[/{id}]
Etiquetas   CRUD /organizations/{id}/labels[/{id}]
Público     GET /public/organizations/{token} ; .../participants
            GET .../participants/{id}/obligations ; POST .../payments   (pago exprés sin login)
Suscripc.   GET /subscriptions/plans | /subscriptions/organization/{id}/status
            POST /subscriptions/organization/{id}/checkout
            GET  /subscriptions/transactions/{id} (recibo)
IA          POST /assistant/chat
```

## 5. Planes y monetización

| Plan | Precio CLP/mes | Límites observados |
|---|---|---|
| Starter | 0 | hasta 15 miembros, 1 cobro activo, portal móvil de miembros |
| Básico | $3.990 | hasta 40 miembros, egresos con boletas, exportación Excel |
| Pro | $7.990 | hasta 100 miembros, Agente IA (comprobantes + copiloto), códigos de vinculación |
| Unlimited | (referenciado en FAQ) | — |

## 6. Pantallas / mapa de chunks

- **Admin:** Dashboard, Obligations (+ ajuste de cuotas), Participants, Payments, Expenses, ExtraIncome, BankAccounts, Labels, Reports (+ ReportDetail), Billing, Profile, Organizations, HelpCenter, NoOrgState.
- **Miembro:** MemberLayout, Dashboard, Obligations + ObligationDetail, Profile.
- **Públicas/compartidas:** Login, Register (+ InviteRegister), ForgotPassword, GoogleAuthSection, Terms, ChatWidget, ThemeToggle, Toast, ConfirmDialog, FileUpload, DocumentPreviewModal (visor zoom/rotar), TransferFormModal, PublicPaymentModal, ExpressPaymentPage, AdminInviteAcceptPage.

## 7. Flujos clave para replicar en tu club

1. **Cobro → pago → validación → recibo:** directiva crea obligación con N cuotas → socio paga por transferencia (datos bancarios copiables) → adjunta comprobante → tesorero aprueba/rechaza → recibo por email con código de seguimiento.
2. **Pago exprés público:** enlace con token de organización permite a un apoderado pagar sin registrarse (útil para padre/madre que no usa la app).
3. **Vinculación multi-apoderado:** códigos de vinculación para que cada tutor se asocie solo.
4. **Morosidad:** consulta `payments/unpaid` y lista de pendientes por cuota y por año.
5. **Transparencia financiera:** reportes con visibilidad configurable para miembros.
6. **Suscripción con pasarela local** (Webpay/Khipu) — solo relevante si quieres cobrar el sistema a otros clubes.

## 8. Recomendación de implementación (XAMPP local)

Dado que el workspace está bajo `htdocs` con XAMPP, un MVP para tu club puede replicar el núcleo con **PHP 8 + MySQL + Blade (o Laravel)**:

- Tablas: `users`, `organizations`, `organization_user` (rol), `participants`, `participant_guardian` (multi-apoderado), `obligations`, `obligation_details`, `payments`, `bank_accounts`, `labels`, `expenses`, `extra_incomes`.
- Núcleo v1: auth con roles, socios + apoderados, cuotas con vencimientos, carga de comprobante (imagen), aprobación/rechazo, recibo PDF con código, reporte de morosidad y balance.
- Fase 2: enlace público de pago (token), correos automáticos, exportación Excel.
- Fase 3: integración Webpay/Khipu y asistente IA (opcional).
