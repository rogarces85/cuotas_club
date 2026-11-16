import type { Context, MiddlewareHandler } from 'hono';
import { auth } from '../auth.js';

/**
 * Middleware de autenticación para las rutas de negocio.
 *
 * Lee la sesión de Better Auth desde la cookie (o header Authorization) del
 * request y la deja disponible en `c.get('session')` / `c.get('user')`.
 * Sin sesión válida responde 401 y corta la cadena.
 *
 * M1 solo exige sesión válida. El control fino por rol (tesorero/directiva)
 * llega con el módulo de usuarios y roles; requireRole queda listo para eso.
 */

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
};

export type SessionContext = {
  session: { userId: string; id: string; expiresAt: Date };
  user: SessionUser;
};

export const requireSession: MiddlewareHandler = async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!result) {
    return c.json({ error: 'No autenticado' }, 401);
  }

  c.set('session', result.session);
  c.set('user', result.user);
  await next();
};

/**
 * Exige un rol concreto para continuar. Uso previsto para M-usuarios:
 *   app.patch('/api/socios/:id', requireSession, requireRole('TESORERO'), ...)
 * No se aplica todavía en M1; el rol vive en la tabla usuario_rol.
 */
export function requireRole(...roles: string[]): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user') as SessionUser | undefined;
    // El rol no se consulta aquí: la lectura real se hace contra usuario_rol
    // cuando el módulo de roles exista. Por ahora, exige solo sesión válida.
    void user;
    void roles;
    await next();
  };
}
