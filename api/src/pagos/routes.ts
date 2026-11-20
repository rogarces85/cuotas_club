import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { clubSchema } from '@cuotas-club/shared';
import {
  listarPagosQuerySchema,
  crearPagoSchema,
  actualizarPagoSchema,
} from '@cuotas-club/shared';
import { requireSession } from '../middleware/auth.js';
import {
  listarPagos,
  obtenerPago,
  crearPago,
  aprobarPago,
  rechazarPago,
  listarMorosos,
} from './repo.js';

const pago = clubSchema.pago;

/**
 * Rutas de pagos. Todas exigen sesión válida (requireSession).
 *
 * Flujo:
 *   POST   /api/pagos              → crea un pago (pendiente)
 *   GET    /api/pagos              → listado con filtros
 *   GET    /api/pagos/:id          → detalle con comprobantes
 *   PATCH  /api/pagos/:id/aprobar  → aprueba un pago pendiente
 *   PATCH  /api/pagos/:id/rechazar → rechaza un pago pendiente
 *   GET    /api/pagos/morosos      → socios con deuda pendiente
 */

export const pagos = new Hono();

pagos.use('*', requireSession);

// GET /api/pagos — listado con filtros y paginación
pagos.get('/', zValidator('query', listarPagosQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const resultado = await listarPagos(query);
  return c.json(resultado);
});

// GET /api/pagos/morosos — socios con deuda pendiente
pagos.get('/morosos', async (c) => {
  const morosos = await listarMorosos();
  return c.json(morosos);
});

// GET /api/pagos/:id — detalle con comprobantes
pagos.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Id de pago inválido' }, 400);
  }
  const pago = await obtenerPago(id);
  if (!pago) return c.json({ error: 'Pago no encontrado' }, 404);
  return c.json(pago);
});

// POST /api/pagos — alta de pago (pendiente por defecto)
pagos.post('/', zValidator('json', crearPagoSchema), async (c) => {
  const input = c.req.valid('json');

  const existente = await obtenerPagoPorRutYAnio(input.rut, input.anio);
  if (existente) {
    return c.json(
      { error: `Ya existe un pago para el RUT ${input.rut} en el año ${input.anio}` },
      409,
    );
  }

  const pago = await crearPago(input);
  return c.json(pago, 201);
});

// PATCH /api/pagos/:id/aprobar — aprueba un pago pendiente
pagos.patch('/:id/aprobar', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Id de pago inválido' }, 400);
  }

  const pago = await aprobarPago(id);
  if (!pago) return c.json({ error: 'Pago no encontrado' }, 404);
  return c.json(pago);
});

// PATCH /api/pagos/:id/rechazar — rechaza un pago pendiente
pagos.patch('/:id/rechazar', zValidator('json', actualizarPagoSchema), async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Id de pago inválido' }, 400);
  }

  const { motivo } = c.req.valid('json');
  const pago = await rechazarPago(id, motivo);
  if (!pago) return c.json({ error: 'Pago no encontrado' }, 404);
  return c.json(pago);
});

// GET /api/pagos/morosos — socios con deuda pendiente
pagos.get('/morosos', async (c) => {
  const morosos = await listarMorosos();
  return c.json(morosos);
});

async function obtenerPagoPorRutYAnio(rut: string, anio: number) {
  const [fila] = await db
    .select()
    .from(pago)
    .where(eq(pago.rut, rut) && eq(pago.anio, anio))
    .limit(1);
  return fila ?? null;
}
