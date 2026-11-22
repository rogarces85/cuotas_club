import { Hono } from 'hono';
import { getPool } from './db/client.js';
import { auth } from './auth.js';
import { socios } from './socios/routes.js';
import { cuotas } from './cuotas/routes.js';
import { pagos } from './pagos/routes.js';
import { upload } from './upload/routes.js';
import { bancos } from './bancos/routes.js';
import { gastos } from './gastos/routes.js';
import { reportes } from './reportes/routes.js';
import { config } from './config/routes.js';
import { panel } from './panel/routes.js';
import { geocoding } from './geocoding/routes.js';
import { cumpleanos } from './cumpleanos/routes.js';

const app = new Hono();

/**
 * Health check: devuelve 200 si el servidor responde y la BD está accesible.
 * Vive bajo /api para que el proxy de Vite (/api → :8787) lo alcance sin reescritura.
 */
app.get('/api/health', async (c) => {
  let db = 'up';
  try {
    await getPool().query('SELECT 1');
  } catch {
    db = 'down';
  }

  return c.json({
    status: 'ok',
    service: 'cuotas-club-api',
    database: db,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Better Auth montado en /api/auth/*, su basePath por defecto.
 * El handler oficial resuelve router, cookies de sesión y comprobación de Origin.
 * No mover esta ruta sin mover también el baseURL/basePath de better-auth.
 */
app.all('/api/auth/*', (c) => auth.handler(c.req.raw));

/**
 * Rutas de negocio, protegidas por sesión dentro de cada router.
 */
app.route('/api/socios', socios);
app.route('/api/cuotas', cuotas);
app.route('/api/pagos', pagos);
app.route('/api/upload', upload);
app.route('/api/bancos', bancos);
app.route('/api/gastos', gastos);
app.route('/api/reportes', reportes);
app.route('/api/config', config);
app.route('/api/panel', panel);
app.route('/api/geocoding', geocoding);
app.route('/api/cumpleanos', cumpleanos);

export default app;
