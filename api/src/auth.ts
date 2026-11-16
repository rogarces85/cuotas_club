import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { getDb } from './db/client.js';
import * as authSchema from './db/auth-schema.js';

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
  trustedOrigins: [process.env.WEB_ORIGIN ?? 'http://localhost:5173'],
});
