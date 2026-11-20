# Cuotas — Osorno Runners

Sistema de gestión de cuotas para el club **Osorno Runners**.

Cobra cuotas, registra pagos por transferencia con comprobante, valida quién pagó y muestra quién debe.

---

## Estado actual

**M0 terminado y en uso local.** El sistema arranca, autentica y muestra el panel con la identidad del club. Los módulos de socios, cuotas y pagos vienen en M1–M3.

| Hito | Qué entrega | Estado |
|---|---|---|
| **M0** | Base: workspaces, base de datos, autenticación, tema y login | ✅ Terminado |
| M1 | Socios: alta, edición, búsqueda | Siguiente |
| M2 | Cuotas: períodos, montos, vencimientos | Pendiente |
| M3 | Pagos: comprobantes, aprobación y estado de cuenta | ✅ Backend completado | Pendiente frontend |
| M4 | Cobranza: morosidad, estado de cuenta | Pendiente |
| M5 | Cierre: reportes, gastos y carga de los 54 socios reales | Pendiente |
| Fase 2 | Landing page pública del club | No iniciada |

> Los indicadores del panel son cifras de muestra. Todavía no leen la base de datos.

---

## Requisitos

| Qué | Versión | Nota |
|---|---|---|
| Node.js | 20 o superior | Probado en v26.13.0 |
| MySQL / MariaDB | Cualquiera con `utf8mb4` | Probado en MariaDB 10.4.32 (XAMPP) |
| npm | 10 o superior | Viene con Node |

Si usas XAMPP: arranca **MySQL** desde el panel de control antes de empezar.

---

## Instalación desde cero

```bash
# 1. Clonar
git clone https://github.com/rogarces85/cuotas_club.git
cd cuotas_club

# 2. Instalar dependencias de los tres workspaces
npm install

# 3. Crear el archivo de entorno
#    Windows PowerShell:
Copy-Item api\.env.example api\.env
#    Linux / macOS:
#    cp api/.env.example api/.env
```

Ahora edita `api/.env` y completa **tres** valores:

| Variable | Qué poner |
|---|---|
| `DB_PASSWORD` | Una clave que elijas para el usuario de la app (la inventas aquí) |
| `BETTER_AUTH_SECRET` | Un secreto aleatorio. Genéralo con el comando de abajo |
| `DB_ROOT_PASSWORD` | La clave de root de tu MySQL (en XAMPP suele estar vacía) |

Para generar el secreto de autenticación:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Continúa con la base de datos:

```bash
# 4. Crear la base y el usuario de la aplicación (usa root solo para esto)
npm run db:setup -w api

# 5. Aplicar las migraciones
npm run db:migrate -w api
```

Si todo salió bien, vas a ver `Conexión con el usuario de la app: verificada` y luego
`Migraciones aplicadas.`

```bash
# 6. Levantar el sistema (API + frontend a la vez)
npm run dev
```

Abre **http://localhost:5173**.

### Crear el primer usuario

No hay usuarios hasta que crees uno. Con el sistema corriendo:

```bash
curl -X POST http://localhost:8787/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"tu-correo@ejemplo.cl\",\"password\":\"TuClaveSegura123\",\"name\":\"Tu Nombre\"}"
```

En PowerShell:

```powershell
$body = @{ email='tu-correo@ejemplo.cl'; password='TuClaveSegura123'; name='Tu Nombre' } | ConvertTo-Json
Invoke-WebRequest http://localhost:8787/api/auth/sign-up/email -Method POST -Body $body -ContentType 'application/json'
```

Después entra por la pantalla de login con ese correo y clave.

Para darle rol de tesorero:

```sql
INSERT INTO usuario_rol (user_id, rol, created_at)
SELECT id, 'TESORERO', UNIX_TIMESTAMP() FROM user WHERE email = 'tu-correo@ejemplo.cl';
```

---

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta API (`:8787`) y frontend (`:5173`) juntos |
| `npm run build` | Compila los tres workspaces para producción |
| `npm run typecheck` | Verifica tipos en todo el proyecto |
| `npm run db:setup -w api` | Crea la base y el usuario de la aplicación |
| `npm run db:migrate -w api` | Aplica las migraciones pendientes |
| `npm run db:generate -w api` | Genera una migración nueva desde el esquema |

---

## Estructura

```
shared/            Esquema Drizzle y validadores Zod, compartidos por api y web
  src/schema/      Tablas del club (socio, pago, pago_mes, comprobante…)
  src/validators.ts  Reglas de validación (RUT, montos en CLP, períodos)

api/               Backend Hono
  src/app.ts       Rutas: /api/health y Better Auth en /api/auth/*
  src/auth.ts      Configuración de Better Auth
  src/db/          Conexión, esquema de auth y migrador
  drizzle/         Migraciones SQL (se leen antes de aplicar)
  scripts/         Generación de esquema, setup de base, prueba E2E

web/               Frontend React
  src/pages/       LoginPage
  src/components/  Shell del sistema
  src/lib/         Cliente de autenticación
```

---

## Cómo está armado

- **Un solo origen.** En desarrollo, Vite hace proxy de `/api` hacia el API en `:8787`. El navegador ve un solo origen, así que no hay CORS y las cookies de sesión funcionan sin configuración extra.
- **Una sola verdad para el esquema.** Las tablas y las validaciones viven en `shared/`, así el cliente y el servidor no pueden discrepar.
- **Los roles no viven en la librería de autenticación.** Better Auth administra identidad y sesión; el rol del club va en la tabla `usuario_rol`. Si mañana se cambia la librería, los permisos no se mueven.
- **Dinero en pesos, como entero.** Sin decimales ni `float`. Un sistema de cuotas que redondea mal pierde la confianza de la tesorería el primer mes.

---

## Problemas conocidos

**MariaDB 10.4 y las migraciones.** Esta versión está fuera de soporte y es más estricta con las columnas de fecha. Por eso las tablas de autenticación usan `datetime` en lugar de `timestamp`. Regla del proyecto: **nunca uses `drizzle-kit push`**. Genera con `db:generate`, lee el SQL y aplica con `db:migrate`.

**Vite se cierra con `EBUSY` en Windows.** Al escribir archivos de forma atómica se crea una carpeta temporal que el watcher no puede abrir. Ya está mitigado en `web/vite.config.ts`.

**Node muy nuevo.** Se probó en Node 26.13.0. Si algo falla al instalar, prueba con la última versión LTS.

---

## Documentación

Toda la documentación vive en [`02-DOCS/wiki/`](02-DOCS/wiki/index.md).

| Documento | Qué contiene |
|---|---|
| [Índice de la wiki](02-DOCS/wiki/index.md) | Punto de entrada |
| [Contexto existente](02-DOCS/wiki/product/contexto-existente.md) | La base preexistente, los 54 socios y los dos entornos |
| [Plan de trabajo](02-DOCS/wiki/product/plan-de-trabajo.md) | Alcance, módulos, hitos y decisiones |
| [Arquitectura](02-DOCS/wiki/product/arquitectura.md) | Stack con versiones verificadas, decisiones y riesgos |
| [Marca y paleta](02-DOCS/wiki/product/marca-y-paleta.md) | Colores medidos del logo, tokens CSS |
| [M0 — base](02-DOCS/wiki/ftd/m0-base.md) | Qué se construyó y con qué evidencia |

---

## Datos del club

Los datos reales viven en el PC de casa. La importación de los 54 socios está planificada para el cierre (M5), no para el arranque: en este repositorio se trabaja con datos de prueba. Ver [contexto existente](02-DOCS/wiki/product/contexto-existente.md).

---

## Identidad

Paleta oficial: **rojo `#DF022F`, negro `#000000`, blanco `#FFFFFF`**. Valores medidos del logo del club, no estimados. Dirección visual: sidebar negra, contenido blanco, rojo solo como acento.

El proyecto usa [rsc-harness](https://github.com/ericrisco/rsc-harness) para organizar documentación y reglas de trabajo. Tras clonar, si quieres reconstruir esa capa:

```bash
npx @ericrisco/rsc@4.1.7 sync
```

## Continuando desde casa

Si estás retomando el trabajo en otra máquina, los pasos son:

```bash
# 1. Clonar el repo (o usar el que ya tengas)
git clone https://github.com/rogarces85/cuotas_club.git
cd cuotas_club

# 2. Instalar dependencias (si aún no las tienes)
npm install

# 3. Levantar la base de datos (XAMPP) y verificar que el API arranque
#    - Asegúrate de que MySQL/MariaDB esté corriendo en XAMPP
#    - `cd api && npx tsx src/index.ts` y prueba http://localhost:8787/api/health

# 4. Opcional: verificar que los cambios del M3 estén aplicados
git log --oneline -3
```

### Tareas pendientes (M3 backend ya en repo, frontend por hacer)

El backend del módulo **M3 - Pagos** ya está completo y subido a GitHub (commit `32fb53e`). Queda por implementar en el frontend:

| Tarea | Archivo | Descripción |
|---|---|---|
| **T3** | `web/src/pages/PagosPage.tsx` | Componente React para listing, crear, aprobar y rechazar pagos |
| **T4** | `web/src/pages/EstadoCuentaPage.tsx` | Ver quién debe qué (deuda derivada: socio activo + periodos sin `pago.estado='APROBADO'`) |
| **T5** | Shell navigation | Integrar enlaces a Pagos/Estado de cuenta en el shell lateral |
| **T6** | Acceptance test | Tests E2E o de nivel API para validar el flujo CRUD y aprobación |

### Comandos útiles desde casa

```bash
# Ver estado actual del repo
git status

# Ver el commit donde quedó M3  
git log --oneline -1

# Typecheck y build
npm run typecheck   # en api, shared, web
npm run build       # en los tres workspaces

# Levantar el sistema completo
npm run dev         # API :8787 + frontend :5173
```

---
