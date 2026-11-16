---
title: Constitución del proyecto — Sistema de cuotas Osorno Runners
type: sdd-constitution
version: v1.0.0
status: ratified
ratified: 2026-11-16
last_amended: null
---

# Constitución — Sistema de cuotas Osorno Runners

Reglas no negociables que heredan todas las fases siguientes (specify, plan,
implement, verify, review). Si se viola una, el trabajo está mal aunque corra.

Deriva de decisiones ya tomadas y registradas en
`02-DOCS/wiki/product/plan-de-trabajo.md`, `arquitectura.md` y
`02-DOCS/wiki/harness/decisions.md`. No las copia: las ratifica como principio
y enlaza el detalle.

## Principios

### Stack canónico

1. **El stack está fijado (D1).** Node + Hono + Drizzle ORM + Better Auth en el
   backend; React + React Hook Form + TanStack Query + Zustand + Tailwind v4 en
   el frontend; MariaDB 10.4.32 como motor. Cambiar una pieza contradice D1 y
   requiere enmendar esta constitución. Detalle y versiones: `arquitectura.md`.
2. **Una sola fuente de verdad para el esquema y la validación.** Las tablas
   Drizzle y los Zod viven en `shared/`; api y web los consumen, nunca los
   redefinen. Ver `arquitectura.md` (A4) y `shared/src/`.

### Datos y dinero

3. **El dinero es entero en CLP.** Ningún monto usa `float` ni decimales. Un
   sistema de cuotas que redondea mal pierde la confianza de la tesorería.
   Enforzado por `shared/src/validators.ts` (`montoClpSchema`). (A2)
4. **El RUT es un identificador normalizado.** Sin puntos ni guion, dígito
   verificador en mayúscula (`17682512K`). Único en `socio`. (D2)
5. **Ninguna migración se aplica sin leer antes su SQL.** MariaDB 10.4 está
   fuera de soporte y Drizzle Kit genera SQL para MySQL 8. Flujo obligatorio:
   `db:generate` → leer → `db:migrate`. **Nunca `drizzle-kit push`.** (D6)

### Autenticación y autorización

6. **La identidad vive en Better Auth; el rol vive en el club.** El rol
   (DIRECTIVA, TESORERO, SOCIO) va en `usuario_rol`, con clave al usuario de
   Better Auth. Nunca en la librería de auth. (A1)
7. **Toda ruta de negocio exige sesión válida.** Las rutas bajo `/api/*`
   (fuera de `/api/auth/*`) no responden sin autenticación: 401. El control
   fino por rol se aplica en el módulo de usuarios y roles.
8. **Los comprobantes no son públicos.** Se guardan en `api/uploads/`, fuera de
   git, y se sirven por ruta autenticada que verifica membresía al club. Nunca
   como estático abierto. (A5)
9. **Ningún secreto se commitea.** Claves y secretos cargan desde `api/.env`
   (gitignored); el repo solo lleva `api/.env.example`. Enforzado por el
   `.gitignore` raíz y `security-audit`.

### Calidad

10. **Typecheck estricto en cero errores para merge.** `npm run typecheck`
    (shared, api y web) debe salir limpio. Los tres usan `strict: true`.
11. **Build de producción en cero errores para merge.** `npm run build`
    compila los tres workspaces.
12. **El cambio se verifica contra evidencia observada, no contra intención.**
    Un ítem se da por hecho cuando su comprobación corrió y salió: salida de
    test, resultado de comando, página renderizada. "Debería funcionar" no es
    evidencia.

### Convenciones

13. **Formularios con React Hook Form + Zod; datos del servidor con TanStack
    Query; estado de UI con Zustand.** Sin mezclar: la API es la única fuente
    del estado del servidor. (A3)
14. **Fechas en UTC en la base, mostradas en `America/Santiago`.** (A6)
15. **La baja de un socio es lógica (`activo = 0`), nunca borrado físico.**
    El padrón histórico se conserva.
16. **Rama por defecto y flujo.** Trabajo en `main` (flujo elegido). El cambio
    que toca `auth`, migraciones o secretos es tier 2 y requiere ASDD + revisión
    adversarial + aprobación humana antes de pushear.

## La barra (Definition of Done)

Todo feature se da por cerrado solo cuando:

- [ ] `npm run typecheck` → 0 errores en los tres workspaces.
- [ ] `npm run build` → 0 errores.
- [ ] La comprobación propia del cambio corrió y su salida quedó registrada
      (test, curl, E2E) bajo Evidence.
- [ ] `rsc risk` informó el tier y se corrió la revisión que corresponde
      (tier 0: ninguna; tier 1: un revisor fresh-context; tier 2: panel de tres
      refutadores + aprobación humana).
- [ ] El documento FTD/ASDD correspondiente quedó actualizado con su evidencia.

## Principios fijos (heredados)

- **La autoría de git es de la persona.** Sin `Co-Authored-By` de una IA ni
  pie "generated with". Enforzado en `ship`.
- **Las decisiones se registran.** Toda decisión significativa se agrega a
  `02-DOCS/wiki/sdd/decisions.md` (o `02-DOCS/wiki/harness/decisions.md`) con
  fecha, opciones y el porqué.

## Registro de enmiendas

- **v1.0.0** — 2026-11-16 — Ratificada. Principios derivados de D1–D6, A1–A6
  y de la documentación existente. La ratificación se decidió en la conversación
  (opción B: sin instalar skills de stack adicionales por ahora).
