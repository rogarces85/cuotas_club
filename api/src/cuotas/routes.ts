import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, desc } from 'drizzle-orm';
import {
  crearPeriodoCuotaSchema,
  crearNivelCuotaSchema,
  actualizarNivelCuotaSchema,
  clubSchema,
} from '@cuotas-club/shared';
import { db } from '../db/client.js';
import { requireSession } from '../middleware/auth.js';
import {
  listarPeriodos,
  obtenerPeriodo,
  periodoPorMes,
  crearPeriodo,
  calcularDeuda,
} from './repo.js';

const { nivelCuota } = clubSchema;

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

// ==================== NIVELES DE CUOTA ====================
// Cuánto paga cada tipo (ACTIVO, MEMBRESIA, BECADO, OTRO). El monto del pago
// se registra al momento de cobrar; estos niveles son la referencia del club.

cuotas.get('/niveles', async (c) => {
  const filas = await db.select().from(nivelCuota).orderBy(desc(nivelCuota.activo), nivelCuota.tipo);
  return c.json(filas);
});

cuotas.post('/niveles', zValidator('json', crearNivelCuotaSchema), async (c) => {
  const input = c.req.valid('json');

  const [existente] = await db
    .select({ id: nivelCuota.id })
    .from(nivelCuota)
    .where(eq(nivelCuota.codigo, input.codigo))
    .limit(1);

  if (existente) {
    return c.json({ error: `Ya existe un nivel con el código ${input.codigo}` }, 409);
  }

  const [result] = await db.insert(nivelCuota).values(input);
  const [fila] = await db
    .select()
    .from(nivelCuota)
    .where(eq(nivelCuota.id, Number(result.insertId)))
    .limit(1);

  return c.json(fila, 201);
});

cuotas.patch('/niveles/:id', zValidator('json', actualizarNivelCuotaSchema), async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Id de nivel inválido' }, 400);
  }

  const input = c.req.valid('json');
  const datos: Record<string, unknown> = { ...input };
  if (input.activo !== undefined) datos.activo = input.activo ? 1 : 0;

  await db.update(nivelCuota).set(datos).where(eq(nivelCuota.id, id));

  const [fila] = await db.select().from(nivelCuota).where(eq(nivelCuota.id, id)).limit(1);
  if (!fila) return c.json({ error: 'Nivel no encontrado' }, 404);
  return c.json(fila);
});

cuotas.delete('/niveles/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Id de nivel inválido' }, 400);
  }

  const [fila] = await db
    .select({ id: nivelCuota.id })
    .from(nivelCuota)
    .where(eq(nivelCuota.id, id))
    .limit(1);

  if (!fila) return c.json({ error: 'Nivel no encontrado' }, 404);

  await db.delete(nivelCuota).where(eq(nivelCuota.id, id));
  return c.json({ ok: true });
});
