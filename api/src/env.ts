import { config } from 'dotenv';

/**
 * Carga las variables de entorno desde api/.env.
 * Se llama una sola vez, al arrancar.
 */
export function loadEnv(): void {
  config();
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Ver api/.env (copia de api/.env.example).`);
  }
  return value;
}

export const env = {
  get host(): string {
    return process.env.DB_HOST ?? '127.0.0.1';
  },
  get port(): number {
    return Number(process.env.DB_PORT ?? 3306);
  },
  get dbName(): string {
    return process.env.DB_NAME ?? 'osorno_runners_v2';
  },
  get dbUser(): string {
    return process.env.DB_USER ?? 'osorno_app';
  },
  get dbPassword(): string {
    return process.env.DB_PASSWORD ?? '';
  },
  get serverPort(): number {
    return Number(process.env.PORT ?? 8787);
  },
  get webOrigin(): string {
    return process.env.WEB_ORIGIN ?? 'http://localhost:5173';
  },
  get betterAuthSecret(): string {
    return process.env.BETTER_AUTH_SECRET ?? '';
  },
  get betterAuthUrl(): string {
    return process.env.BETTER_AUTH_URL ?? 'http://localhost:8787';
  },
};
