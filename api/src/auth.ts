import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { getDb } from './db/client.js';
import * as authSchema from './db/auth-schema.js';
import { env } from './env.js';

/**
 * Better Auth con adaptador Drizzle + MySQL y login por email/contraseña.
 * El esquema de auth (tablas user, session, account, verification) se genera
 * con el generador oficial de Better Auth y vive en db/auth-schema.ts.
 */
export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: 'mysql',
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  // Sin basePath explícito better-auth usa '/api/auth', que es donde app.ts
  // monta el handler. Si se cambia ese montaje hay que mover también este valor
  // (o el baseURL) o todas las rutas de auth responderán 404.
  baseURL: env.betterAuthUrl,
  trustedOrigins: [env.webOrigin],
});
