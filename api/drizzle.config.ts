import { defineConfig } from 'drizzle-kit';

/**
 * Configuración de Drizzle Kit para MariaDB.
 *
 * El esquema se apunta directamente a los archivos fuente (globs), no a un
 * re-export compilado. Así drizzle-kit ve las definiciones mysqlTable reales.
 *
 * ATENCIÓN (decisión D6): la máquina corre MariaDB 10.4, fuera de soporte.
 * Regla: NUNCA usar `drizzle-kit push`. Siempre `generate`, LEER el SQL,
 * y recién entonces `migrate`.
 */
export default defineConfig({
  dialect: 'mysql',
  schema: [
    '../shared/src/schema/club.ts',
    './src/db/auth-schema.ts',
  ],
  out: './drizzle',
  dbCredentials: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'osorno_app',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'osorno_runners_v2',
  },
  casing: 'snake_case',
});
