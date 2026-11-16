---
title: Arquitectura — stack y estructura
type: architecture
status: accepted
updated: 2026-11-16
---

# Arquitectura — stack y estructura

## Stack confirmado

Versiones consultadas en el registro de npm el 2026-11-16. Son las vigentes, no las que recuerdo.

| Capa | Pieza | Versión |
|---|---|---|
| Runtime | Node.js (instalado en la máquina) | v26.13.0 |
| Servidor | Hono | 4.13.19 |
| Servidor Node | `@hono/node-server` | 2.1.8 |
| ORM | Drizzle ORM | 0.45.4 |
| Migraciones | Drizzle Kit | 0.31.11 |
| Autenticación | Better Auth | 1.7.25 |
| Adaptador de BD | `@better-auth/drizzle-adapter` | 1.7.25 |
| Base de datos | MariaDB 10.4.32 (XAMPP, puerto 3306 verificado) | driver `mysql2` 3.24.6 |
| UI | React + React DOM | 19.3.1 |
| Build | Vite | 8.3.8 |
| Componentes | shadcn/ui (`shadcn` CLI) | 4.23.0 |
| Estilos | Tailwind CSS + `@tailwindcss/vite` | 4.3.5 |
| Formularios | React Hook Form + `@hookform/resolvers` | 7.92.0 / 7.0.6 |
| Validación | Zod + `@hono/zod-validator` | 4.6.7 / 0.9.1 |
| Datos del servidor | TanStack Query | 5.107.1 |
| Estado de UI | Zustand | 5.1.0 |
| Pruebas | Vitest | 5.1.0 |
| Correo saliente | Gmail SMTP (`smtp.gmail.com:587`) desde `tesoreriaor@gmail.com` | contraseña de aplicación en `.env` |

Coincide con el stack del que sale la referencia visual (Zenith): React, shadcn y Tailwind. Por eso los tokens de `marca-y-paleta.md` entran sin traducción.

## Forma del sistema

Un solo repositorio, tres espacios de trabajo con npm workspaces.

```
osorno-runners/
├─ package.json                 # workspaces + scripts raíz
├─ shared/                      # código compartido por api y web
│  └─ src/
│     ├─ schema/                # tablas Drizzle (fuente única de verdad)
│     └─ validators/            # esquemas Zod
├─ api/                         # backend Hono
│  ├─ src/
│  │  ├─ index.ts               # app Hono, montaje de rutas
│  │  ├─ auth.ts                # betterAuth + drizzleAdapter
│  │  ├─ db/client.ts           # drizzle(mysql2)
│  │  ├─ middleware/session.ts  # sesión en el contexto
│  │  └─ routes/                # socios, cuotas, pagos…
│  ├─ uploads/                  # comprobantes (fuera de git)
│  └─ drizzle/                  # migraciones generadas
└─ web/                         # frontend React
   └─ src/
      ├─ main.tsx
      ├─ routes/                # pantallas
      ├─ components/ui/         # primitivas shadcn
      ├─ features/              # lógica por módulo
      ├─ stores/                # Zustand
      └─ lib/http.ts            # cliente fetch
```

`shared/` evita el error clásico: definir la tabla dos veces y que el cliente y el servidor discrepen. El esquema Drizzle y los Zod viven una sola vez.

## Cómo se conectan las piezas

### Desarrollo (dos procesos, un origen)

Vite en `5173`, Hono en `8787`. Vite hace proxy de `/api` hacia Hono:

```ts
// web/vite.config.ts
server: {
  proxy: {
    '/api': { target: 'http://localhost:8787', changeOrigin: true },
  },
}
```

Con esto el navegador ve un solo origen. **No hay CORS y las cookies de sesión funcionan sin configuración extra.** Es la razón de montar el proxy en vez de llamar a `http://localhost:8787` directamente: la documentación de Better Auth exige CORS con credenciales y `trustedOrigins` cuando los orígenes difieren, y eso es una fuente de errores que no necesitamos.

### Producción (un proceso, un origen)

`vite build` deja los archivos en `web/dist`. Hono los sirve como estáticos y expone la API en el mismo puerto. Un solo servicio que levantar.

```
GET /            → web/dist/index.html
GET /assets/*    → web/dist/assets/*
GET /api/auth/*  → Better Auth
GET /api/*       → rutas Hono
```

## Autenticación

Better Auth se monta directo en Hono. Ambos usan `Request` y `Response` web estándar, así que no hace falta adaptador de servidor:

```ts
// api/src/index.ts
app.all('/api/auth/*', (c) => auth.handler(c.req.raw));
```

El adaptador de base de datos **es un paquete aparte desde la versión 1.7**: `@better-auth/drizzle-adapter`. No viene dentro de `better-auth`, a diferencia de versiones anteriores. Montarlo mal es el error más probable del primer día.

```ts
// api/src/auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { db } from './db/client';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'mysql' }),
  emailAndPassword: { enabled: true },
});
```

Para las rutas protegidas, la sesión entra por middleware:

```ts
// api/src/middleware/session.ts
const session = await auth.api.getSession({ headers: c.req.raw.headers });
c.set('session', session);
```

## Decisiones de arquitectura

**A1 · Los roles no viven en Better Auth.**
El rol (directiva, tesorero, socio) va en una tabla propia del club, con clave foránea al usuario. Better Auth solo administra identidad y sesión. Si mañana se cambia la librería de autenticación, los permisos del club no se mueven. Además evita depender del comportamiento de un plugin.

**A2 · Dinero en pesos, como entero.**
Los montos se guardan como `int` en CLP. Sin decimales, sin `float`. Un sistema de cuotas que redondea mal pierde la confianza de la directiva el primer mes.

**A3 · TanStack Query para el servidor, Zustand para la interfaz.**
TanStack Query es la única fuente del estado que viene de la API: caché, reintentos, invalidación después de aprobar un pago. Zustand guarda lo que no es del servidor: filtros de la tabla, período seleccionado, sidebar abierta. Mezclar ambos es el error que convierte el panel en un laberinto de estados.

**A4 · Un esquema Zod, dos usos.**
El mismo esquema valida en el formulario (RHF) y en la ruta (Hono). Una regla de negocio, un lugar.

**A5 · Los comprobantes no son públicos.**
Se guardan en `api/uploads/`, fuera de git, con nombre aleatorio. La base guarda ruta, tipo MIME, tamaño y hash. Se sirven por una ruta autenticada que verifica que el usuario pertenece al club. Nunca como estático abierto: ahí van datos bancarios de socios.

**A6 · Fechas en UTC, mostradas en Chile.**
Better Auth guarda en UTC. La interfaz muestra en `America/Santiago`. El cambio de hora de Chile tiene dos fechas al año y es la fuente de bugs de vencimiento.

## Riesgos verificados

| Riesgo | Detalle | Mitigación |
|---|---|---|
| **Node v26.13.0 es muy nuevo** | No es LTS. Algunas dependencias aún no lo declaran soportado | Si algo falla en la instalación, usar Node 24 LTS con `nvm`. Anotar la versión en `.nvmrc` |
| **MariaDB 10.4.32, fuera de soporte** | Verificado en la máquina. Fin de vida en junio de 2024. Drizzle Kit genera SQL para MySQL 8 | Decisión D6: permanecer en 10.4 y revisar cada migración a mano. Ver [compatibilidad](#compatibilidad-con-mariadb-104) |
| **XAMPP: root sin contraseña** | Verificado: la conexión `root` sin clave funciona | Crear un usuario de base de datos dedicado para la app, con clave. No usar root |
| **shadcn asume Tailwind v4** | La CLI 4.x y Tailwind 4.3 usan configuración por CSS, no `tailwind.config.js` | Seguir la instalación oficial de shadcn para Vite. No copiar tutoriales de Tailwind 3 |
| **React 19 con librerías viejas** | Algunas dependencias del ecosistema todavía esperan React 18 | Preferir paquetes que ya declaren React 19. Revisar avisos de peer dependencies |

## Compatibilidad con MariaDB 10.4

Decisión D6: se permanece en MariaDB 10.4.32. Eso obliga a una regla de trabajo.

**Regla:** ninguna migración se aplica sin leer antes el SQL generado.

### Qué no existe en 10.4 y sí en MySQL 8

| Elemento | Estado en MariaDB 10.4 | Qué hacer |
|---|---|---|
| Colación `utf8mb4_0900_ai_ci` | No existe. Es de MySQL 8 | Fijar `utf8mb4_unicode_ci` o `utf8mb4_general_ci` en la conexión y en el esquema |
| `RENAME COLUMN` | Llegó en MariaDB 10.5.2 | En 10.4 se usa `CHANGE COLUMN viejo nuevo tipo` |
| `JSON_TABLE` | Llegó en MariaDB 10.6 | No usar en consultas |
| Tipo `JSON` | Es alias de `LONGTEXT` con validación | Sirve, pero sin índices funcionales sobre JSON |
| `ALTER ... ALGORITHM=INSTANT` | Solo en casos limitados | Reescribir la migración si aparece |
| CTE (`WITH`), funciones de ventana | Disponibles desde 10.2 | Sin problema |
| Restricciones `CHECK` | Disponibles desde 10.2.1 | Sin problema |

### Flujo obligatorio de migración

```bash
npx drizzle-kit generate      # genera el SQL
# LEER el archivo generado en api/drizzle/*.sql
# buscar sintaxis que 10.4 no soporta
npx drizzle-kit migrate       # recién entonces aplicar
```

Una comprobación rápida antes de aplicar:

```powershell
Select-String -Path .\api\drizzle\*.sql -Pattern 'utf8mb4_0900|RENAME COLUMN|JSON_TABLE|ALGORITHM=INSTANT'
```

Si devuelve algo, esa migración se reescribe a mano. No se aplica.

**Nunca usar `drizzle-kit push`.** Genera y aplica en un solo paso, sin oportunidad de revisar. Con 10.4 eso es apostar los datos del club a que la herramienta acierte.

### Configuración de la conexión

```ts
// api/src/db/client.ts
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';

const pool = mysql.createPool({
  host: '127.0.0.1',
  port: 3306,
  database: 'osorno_runners_v2',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  charset: 'utf8mb4_unicode_ci',
});

export const db = drizzle(pool);
```

### Prueba de humo de las migraciones

Mantener una base de descarte (`osorno_runners_v2_test`). Cada migración se prueba ahí primero. Si algo falla, se rompe la base de prueba y no la del club.

## Comandos del primer día (M0)

```bash
# 1. Base del repositorio y workspaces
npm init -y
# editar package.json → "workspaces": ["shared", "api", "web"]

# 2. Backend
npm create hono@latest api -- --template nodejs
cd api
npm i drizzle-orm mysql2 better-auth @better-auth/drizzle-adapter
npm i -D drizzle-kit
npm i hono @hono/node-server @hono/zod-validator zod

# 3. Esquema de Better Auth
npx auth@latest generate    # crea el esquema Drizzle
npx drizzle-kit generate    # genera la migración
npx drizzle-kit migrate     # la aplica

# 4. Frontend
npm create vite@latest web -- --template react-ts
cd web
npm i tailwindcss @tailwindcss/vite
npx shadcn@latest init
npm i @tanstack/react-query zustand react-hook-form @hookform/resolvers zod
```

Después de esto, el criterio de cierre de M0 es concreto: entrar con un usuario de prueba y ver el panel con la paleta del club.

## Fuentes consultadas

- Better Auth, integración con Hono: https://better-auth.com/docs/integrations/hono
- Better Auth, adaptador Drizzle: https://better-auth.com/docs/adapters/drizzle
- shadcn/ui, instalación con Vite: https://ui.shadcn.com/docs/installation/vite
- Versiones: registro de npm, consultado el 2026-11-16
