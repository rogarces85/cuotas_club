import { createAuthClient } from 'better-auth/react';

/**
 * Cliente de Better Auth para el navegador.
 *
 * baseURL es el origen de la web: Vite hace proxy de /api hacia el API (:8787),
 * así que el navegador ve un solo origen y las cookies de sesión funcionan
 * sin CORS. En producción, el mismo origen sirve el estático y la API.
 */
export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
  basePath: '/api/auth',
});

export const { signIn, signUp, signOut, useSession } = authClient;
