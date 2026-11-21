import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { clubSchema } from '@cuotas-club/shared';
import {
  crearCuentaBancariaSchema,
  crearPeriodoCuotaSchema,
} from '@cuotas-club/shared';
import { requireSession } from '../middleware/auth.js';
import { parse } from 'csv-parse/sync';
import { readFile } from 'node:fs/promises';

const {
  cuentaBancaria,
  movimientoBancario,
  pago,
  pagoMes,
  socio,
} = clubSchema;

const nowSec = () => Math.floor(Date.now() / 1000);

/**
 * Rutas de bancos y conciliación.
 *
 * GET    /api/bancos/cuentas           — listar cuentas bancarias del club
 * POST   /api/bancos/cuentas           — crear cuenta bancaria
 * GET    /api/bancos/movimientos       — listar movimientos importados
 * POST   /api/bancos/importar          — importar CSV/Excel de cartola
 * POST   /api/bancos/conciliar         — sugerir matches movimientos ↔ pagos pendientes
 */

export const bancos = new Hono();

bancos.use('*', requireSession);

// GET /api/bancos/cuentas
bancos.get('/cuentas', async (c) => {
  const cuentas = await db
    .select()
    .from(cuentaBancaria)
    .orderBy(desc(cuentaBancaria.createdAt));

  return c.json(cuentas);
});

// POST /api/bancos/cuentas
bancos.post('/cuentas', zValidator('json', crearCuentaBancariaSchema), async (c) => {
  const input = c.req.valid('json');
  const ts = nowSec();

  const [result] = await db
    .insert(cuentaBancaria)
    .values({
      ...input,
      createdAt: ts,
    });

  const [cuenta] = await db
    .select()
    .from(cuentaBancaria)
    .where(eq(cuentaBancaria.id, Number(result.insertId)))
    .limit(1);

  return c.json(cuenta, 201);
});

// GET /api/bancos/movimientos
bancos.get('/movimientos', async (c) => {
  const { pagina = '1', porPagina = '50', conciliado } = c.req.query();

  const page = Math.max(1, parseInt(pagina, 10));
  const limit = Math.min(100, Math.max(1, parseInt(porPagina, 10)));
  const offset = (page - 1) * limit;

  const condiciones = [];
  if (conciliado !== undefined) {
    condiciones.push(eq(movimientoBancario.id, conciliado === 'true' ? 1 : 0)); // placeholder - need real column
  }

  const where = condiciones.length > 0 ? and(...condiciones) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(movimientoBancario)
    .where(where);

  const filas = await db
    .select()
    .from(movimientoBancario)
    .where(where)
    .orderBy(desc(movimientoBancario.fecha), desc(movimientoBancario.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    total: Number(total),
    pagina: page,
    porPagina: limit,
    filas,
  });
});

// POST /api/bancos/importar — importar CSV de cartola bancaria
// Formato esperado: fecha,monto,descripcion,referencia
// fecha: AAAA-MM-DD, monto: entero (CLP), descripcion: texto, referencia: opcional
bancos.post('/importar', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('archivo');

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No se recibió archivo (campo "archivo")' }, 400);
  }

  const text = await file.text();
  let registros: any[] = [];

  // Intentar parsear como CSV
  try {
    registros = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter: ',',
    });
  } catch {
    return c.json({ error: 'No se pudo parsear el CSV. Verifique el formato.' }, 400);
  }

  if (registros.length === 0) {
    return c.json({ error: 'El archivo no contiene datos válidos' }, 400);
  }

  const ts = nowSec();
  let importados = 0;
  let errores: string[] = [];

  for (let i = 0; i < registros.length; i++) {
    const r = registros[i];
    const fila = i + 2; // +1 por header, +1 base 1

    try {
      // Validar campos requeridos
      if (!r.fecha || !r.monto || !r.descripcion) {
        errores.push(`Fila ${fila}: faltan campos requeridos (fecha, monto, descripcion)`);
        continue;
      }

      // Validar formato fecha
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.fecha)) {
        errores.push(`Fila ${fila}: fecha inválida "${r.fecha}" (debe ser AAAA-MM-DD)`);
        continue;
      }

      const monto = parseInt(r.monto, 10);
      if (isNaN(monto)) {
        errores.push(`Fila ${fila}: monto inválido "${r.monto}"`);
        continue;
      }

      await db.insert(movimientoBancario).values({
        fecha: r.fecha,
        monto,
        descripcion: r.descripcion.trim(),
        referencia: r.referencia?.trim() || null,
        createdAt: ts,
      });

      importados++;
    } catch (err) {
      errores.push(`Fila ${fila}: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    }
  }

  return c.json({
    importados,
    errores,
    totalFilas: registros.length,
  });
});

// POST /api/bancos/conciliar — sugerir matches movimientos ↔ pagos pendientes
// Lógica: monto exacto + RUT en descripción + ventana ±2 días
bancos.post('/conciliar', async (c) => {
  // Obtener movimientos sin conciliar (por ahora todos, luego agregar columna conciliado)
  const movimientos = await db
    .select()
    .from(movimientoBancario)
    .orderBy(desc(movimientoBancario.fecha), desc(movimientoBancario.createdAt))
    .limit(200);

  // Obtener pagos pendientes
  const pagosPendientes = await db
    .select({
      id: pago.id,
      rut: pago.rut,
      nombreSnapshot: pago.nombreSnapshot,
      totalPago: pago.totalPago,
      fechaPago: pago.fechaPago,
    })
    .from(pago)
    .where(eq(pago.estado, 'PENDIENTE'));

  const sugerencias = [];

  for (const mov of movimientos) {
    // Buscar pagos con mismo monto
    const mismosMonto = pagosPendientes.filter((p) => p.totalPago === mov.monto);

    for (const pg of mismosMonto) {
      let score = 0;
      const razones: string[] = [];

      // 1. RUT en descripción del movimiento
      const rutNormalizado = pg.rut.replace(/[.-]/g, '').toUpperCase();
      if (mov.descripcion.toUpperCase().includes(rutNormalizado)) {
        score += 50;
        razones.push('RUT coincide en descripción');
      }

      // 2. Nombre en descripción (parcial)
      const nombrePartes = pg.nombreSnapshot.split(' ').filter((p) => p.length > 3);
      for (const parte of nombrePartes) {
        if (mov.descripcion.toUpperCase().includes(parte.toUpperCase())) {
          score += 10;
          razones.push(`Nombre parcial: ${parte}`);
          break;
        }
      }

      // 3. Ventana de fecha ±2 días
      const fechaPago = new Date(pg.fechaPago + 'T00:00:00');
      const fechaMov = new Date(mov.fecha + 'T00:00:00');
      const diffDias = Math.abs((fechaPago.getTime() - fechaMov.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDias <= 2) {
        score += 30;
        razones.push(`Fecha cercana (${diffDias} día${diffDias === 1 ? '' : 's'})`);
      } else if (diffDias <= 7) {
        score += 10;
        razones.push(`Fecha en semana (${diffDias} días)`);
      }

      // 4. Referencia numérica (últimos 4 dígitos del monto o similar)
      if (mov.referencia && pg.totalPago.toString().includes(mov.referencia.slice(-4))) {
        score += 5;
        razones.push('Referencia parcial coincide');
      }

      if (score > 0) {
        sugerencias.push({
          movimiento: {
            id: mov.id,
            fecha: mov.fecha,
            monto: mov.monto,
            descripcion: mov.descripcion,
            referencia: mov.referencia,
          },
          pago: {
            id: pg.id,
            rut: pg.rut,
            nombre: pg.nombreSnapshot,
            total: pg.totalPago,
            fecha: pg.fechaPago,
          },
          score,
          razones,
        });
      }
    }
  }

  // Ordenar por score descendente
  sugerencias.sort((a, b) => b.score - a.score);

  return c.json({ sugerencias });
});