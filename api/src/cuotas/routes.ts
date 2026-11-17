import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { crearPeriodoCuotaSchema } from '@cuotas-club/shared';
import { requireSession } from '../middleware/auth.js';
import {
  listarPeriodos,
  obtenerPeriodo,
  periodoPorMes,
  crearPeriodo,
  calcularDeuda,
} from './repo.js';

/**
 * Rutas de cuotas. Todas exigen sesión válida (requireSession).
 * Ver 02-DOCS/wiki/sdd/specs/cuotas-m2.md.
 */

export const cuotas = new Hono();

cuotas.use('*', requireSession);

// GET /api/cuotas/periodos — lista de períodos con total de deudores.
cuotas.get('/periodos', async (c) => {
  const periodos = await listarPeriodos();
  return c.json(periodos);
});

// POST /api/cuotas/periodos — crear un período (409 si el mes ya existe).
cuotas.post('/periodos', zValidator('json', crearPeriodoCuotaSchema), async (c) => {
  const input = c.req.valid('json');

  const existente = await periodoPorMes(input.periodo);
  if (existente) {
    return c.json({ error: `Ya existe el período ${input.periodo}` }, 409);
  }

  try {
    const periodo = await crearPeriodo(input);
    return c.json(periodo, 201);
  } catch (err) {
    // Carrera: otro request creó el mismo mes entre el check y el insert.
    // El índice único lo rechaza con ER_DUP_ENTRY (1062); devolvemos 409.
    const code = (err as { code?: string }).code;
    if (code === 'ER_DUP_ENTRY') {
      return c.json({ error: `Ya existe el período ${input.periodo}` }, 409);
    }
    throw err;
  }
});

// GET /api/cuotas/periodos/:id/deuda — deuda derivada del período.
cuotas.get('/periodos/:id/deuda', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Id de período inválido' }, 400);
  }

  const periodo = await obtenerPeriodo(id);
  if (!periodo) return c.json({ error: 'Período no encontrado' }, 404);

  const deuda = await calcularDeuda(id);
  return c.json(deuda);
});
