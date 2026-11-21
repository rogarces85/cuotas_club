import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, desc, and, sql, gte, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { clubSchema } from '@cuotas-club/shared';
import {
  crearCategoriaEgresoSchema,
  actualizarCategoriaEgresoSchema,
  crearEgresoSchema,
  actualizarEgresoSchema,
  crearGastoFijoSchema,
  actualizarGastoFijoSchema,
  crearOtroIngresoSchema,
  actualizarOtroIngresoSchema,
  listarEgresosQuerySchema,
  listarOtrosIngresosQuerySchema,
  listarGastosFijosQuerySchema,
} from '@cuotas-club/shared';
import { requireSession } from '../middleware/auth.js';
import { createHash } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { existsSync } from 'node:fs';

const {
  categoriaEgreso,
  egreso,
  gastoFijo,
  otroIngreso,
} = clubSchema;

const nowSec = () => Math.floor(Date.now() / 1000);

const MIME_PERMITIDOS_BOLETA = new Set(['application/pdf', 'image/png', 'image/jpeg']);
const MAX_BYTES_BOLETA = 5 * 1024 * 1024; // 5 MB
const UPLOAD_DIR_BOLETAS = join(process.cwd(), 'uploads', 'boletas');

/**
 * Rutas de gastos/egresos (M5).
 *
 * Categorías de egreso:
 *   GET    /api/gastos/categorias           — listar
 *   POST   /api/gastos/categorias           — crear
 *   PATCH  /api/gastos/categorias/:id       — actualizar
 *   DELETE /api/gastos/categorias/:id       — eliminar
 *
 * Egresos:
 *   GET    /api/gastos/egresos              — listar con filtros
 *   POST   /api/gastos/egresos              — crear
 *   GET    /api/gastos/egresos/:id          — detalle
 *   PATCH  /api/gastos/egresos/:id          — actualizar
 *   DELETE /api/gastos/egresos/:id          — eliminar
 *   POST   /api/gastos/egresos/:id/boleta   — subir boleta (multipart)
 *
 * Gastos fijos:
 *   GET    /api/gastos/fijos                — listar
 *   POST   /api/gastos/fijos                — crear
 *   PATCH  /api/gastos/fijos/:id            — actualizar
 *   DELETE /api/gastos/fijos/:id            — eliminar
 *
 * Otros ingresos:
 *   GET    /api/gastos/ingresos             — listar con filtros
 *   POST   /api/gastos/ingresos             — crear
 *   PATCH  /api/gastos/ingresos/:id         — actualizar
 *   DELETE /api/gastos/ingresos/:id         — eliminar
 */

export const gastos = new Hono();

gastos.use('*', requireSession);

// ==================== CATEGORÍAS DE EGRESO ====================

gastos.get('/categorias', async (c) => {
  const categorias = await db
    .select()
    .from(categoriaEgreso)
    .orderBy(categoriaEgreso.nombre);

  return c.json(categorias);
});

gastos.post('/categorias', zValidator('json', crearCategoriaEgresoSchema), async (c) => {
  const input = c.req.valid('json');
  const ts = nowSec();

  const [result] = await db
    .insert(categoriaEgreso)
    .values({ nombre: input.nombre, createdAt: ts });

  const [cat] = await db
    .select()
    .from(categoriaEgreso)
    .where(eq(categoriaEgreso.id, Number(result.insertId)))
    .limit(1);

  return c.json(cat, 201);
});

gastos.patch('/categorias/:id', zValidator('json', actualizarCategoriaEgresoSchema), async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Id de categoría inválido' }, 400);
  }

  const input = c.req.valid('json');

  await db
    .update(categoriaEgreso)
    .set(input)
    .where(eq(categoriaEgreso.id, id));

  const [cat] = await db
    .select()
    .from(categoriaEgreso)
    .where(eq(categoriaEgreso.id, id))
    .limit(1);

  if (!cat) return c.json({ error: 'Categoría no encontrada' }, 404);
  return c.json(cat);
});

gastos.delete('/categorias/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Id de categoría inválido' }, 400);
  }

  // Verificar si tiene egresos asociados
  const [tieneEgresos] = await db
    .select({ count: sql<number>`count(*)` })
    .from(egreso)
    .where(eq(egreso.categoriaId, id));

  if (Number(tieneEgresos.count) > 0) {
    return c.json({ error: 'No se puede eliminar: tiene egresos asociados' }, 409);
  }

  await db.delete(categoriaEgreso).where(eq(categoriaEgreso.id, id));
  return c.json({ ok: true });
});

// ==================== EGRESOS ====================

gastos.get('/egresos', zValidator('query', listarEgresosQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const { q, categoriaId, desde, hasta, pagina = 1, porPagina = 25 } = query;

  const condiciones = [];
  if (categoriaId) condiciones.push(eq(egreso.categoriaId, categoriaId));
  if (desde) condiciones.push(gte(egreso.fecha, new Date(desde + 'T00:00:00')));
  if (hasta) condiciones.push(lte(egreso.fecha, new Date(hasta + 'T00:00:00')));

  const where = condiciones.length > 0 ? and(...condiciones) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(egreso)
    .where(where);

  const filas = await db
    .select({
      id: egreso.id,
      categoriaId: egreso.categoriaId,
      fecha: egreso.fecha,
      monto: egreso.monto,
      descripcion: egreso.descripcion,
      boletaRuta: egreso.boletaRuta,
      createdAt: egreso.createdAt,
      categoriaNombre: categoriaEgreso.nombre,
    })
    .from(egreso)
    .leftJoin(categoriaEgreso, eq(egreso.categoriaId, categoriaEgreso.id))
    .where(where)
    .orderBy(desc(egreso.fecha), desc(egreso.createdAt))
    .limit(porPagina)
    .offset((pagina - 1) * porPagina);

  return c.json({
    total: Number(total),
    pagina,
    porPagina,
    filas,
  });
});

gastos.post('/egresos', zValidator('json', crearEgresoSchema), async (c) => {
  const input = c.req.valid('json');
  const ts = nowSec();

  const [result] = await db
    .insert(egreso)
    .values({
      categoriaId: input.categoriaId,
      fecha: new Date(input.fecha + 'T00:00:00'),
      monto: input.monto,
      descripcion: input.descripcion,
      createdAt: ts,
    });

  const [egr] = await db
    .select({
      id: egreso.id,
      categoriaId: egreso.categoriaId,
      fecha: egreso.fecha,
      monto: egreso.monto,
      descripcion: egreso.descripcion,
      boletaRuta: egreso.boletaRuta,
      createdAt: egreso.createdAt,
      categoriaNombre: categoriaEgreso.nombre,
    })
    .from(egreso)
    .leftJoin(categoriaEgreso, eq(egreso.categoriaId, categoriaEgreso.id))
    .where(eq(egreso.id, Number(result.insertId)))
    .limit(1);

  return c.json(egr, 201);
});

gastos.get('/egresos/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Id de egreso inválido' }, 400);
  }

  const [egr] = await db
    .select({
      id: egreso.id,
      categoriaId: egreso.categoriaId,
      fecha: egreso.fecha,
      monto: egreso.monto,
      descripcion: egreso.descripcion,
      boletaRuta: egreso.boletaRuta,
      createdAt: egreso.createdAt,
      categoriaNombre: categoriaEgreso.nombre,
    })
    .from(egreso)
    .leftJoin(categoriaEgreso, eq(egreso.categoriaId, categoriaEgreso.id))
    .where(eq(egreso.id, id))
    .limit(1);

  if (!egr) return c.json({ error: 'Egreso no encontrado' }, 404);
  return c.json(egr);
});

gastos.patch('/egresos/:id', zValidator('json', actualizarEgresoSchema), async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Id de egreso inválido' }, 400);
  }

  const input = c.req.valid('json');
  const updateData: Record<string, unknown> = { ...input };

  if (input.fecha) {
    updateData.fecha = new Date(input.fecha + 'T00:00:00');
  }

  await db
    .update(egreso)
    .set(updateData)
    .where(eq(egreso.id, id));

  const [egr] = await db
    .select({
      id: egreso.id,
      categoriaId: egreso.categoriaId,
      fecha: egreso.fecha,
      monto: egreso.monto,
      descripcion: egreso.descripcion,
      boletaRuta: egreso.boletaRuta,
      createdAt: egreso.createdAt,
      categoriaNombre: categoriaEgreso.nombre,
    })
    .from(egreso)
    .leftJoin(categoriaEgreso, eq(egreso.categoriaId, categoriaEgreso.id))
    .where(eq(egreso.id, id))
    .limit(1);

  if (!egr) return c.json({ error: 'Egreso no encontrado' }, 404);
  return c.json(egr);
});

gastos.delete('/egresos/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Id de egreso inválido' }, 400);
  }

  await db.delete(egreso).where(eq(egreso.id, id));
  return c.json({ ok: true });
});

// POST /api/gastos/egresos/:id/boleta — subir boleta (multipart)
gastos.post('/egresos/:id/boleta', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Id de egreso inválido' }, 400);
  }

  const [egr] = await db.select().from(egreso).where(eq(egreso.id, id)).limit(1);
  if (!egr) return c.json({ error: 'Egreso no encontrado' }, 404);

  const formData = await c.req.formData();
  const file = formData.get('archivo');

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No se recibió archivo (campo "archivo")' }, 400);
  }

  const mime = file.type;
  if (!MIME_PERMITIDOS_BOLETA.has(mime)) {
    return c.json(
      { error: `Tipo de archivo no permitido: ${mime}. Permitidos: PDF, PNG, JPEG` },
      400,
    );
  }

  const bytes = file.size;
  if (bytes > MAX_BYTES_BOLETA) {
    return c.json({ error: `Archivo muy grande: ${bytes} bytes (máx ${MAX_BYTES_BOLETA})` }, 400);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const sha256 = createHash('sha256').update(buffer).digest('hex');

  const ext = mime === 'application/pdf' ? '.pdf' : mime === 'image/png' ? '.png' : '.jpg';
  const nombreArchivo = `${sha256}${ext}`;
  const rutaRelativa = join('boletas', nombreArchivo);
  const rutaAbsoluta = join(UPLOAD_DIR_BOLETAS, nombreArchivo);

  if (!existsSync(UPLOAD_DIR_BOLETAS)) {
    await mkdir(UPLOAD_DIR_BOLETAS, { recursive: true });
  }

  if (!existsSync(rutaAbsoluta)) {
    await writeFile(rutaAbsoluta, buffer);
  }

  // Actualizar egreso con la ruta de la boleta
  await db
    .update(egreso)
    .set({ boletaRuta: rutaRelativa })
    .where(eq(egreso.id, id));

  return c.json({
    ruta: rutaRelativa,
    nombreArchivo: file.name,
    mime,
    bytes,
    sha256,
  });
});

// ==================== GASTOS FIJOS ====================

gastos.get('/fijos', zValidator('query', listarGastosFijosQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const { activo, pagina = 1, porPagina = 25 } = query;

  const condiciones = [];
  if (activo !== undefined) condiciones.push(eq(gastoFijo.activo, activo ? 1 : 0));

  const where = condiciones.length > 0 ? and(...condiciones) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(gastoFijo)
    .where(where);

  const filas = await db
    .select()
    .from(gastoFijo)
    .where(where)
    .orderBy(desc(gastoFijo.createdAt))
    .limit(porPagina)
    .offset((pagina - 1) * porPagina);

  return c.json({
    total: Number(total),
    pagina,
    porPagina,
    filas,
  });
});

gastos.post('/fijos', zValidator('json', crearGastoFijoSchema), async (c) => {
  const input = c.req.valid('json');
  const ts = nowSec();

  const [result] = await db
    .insert(gastoFijo)
    .values({
      descripcion: input.descripcion,
      monto: input.monto,
      periodicidad: input.periodicidad,
      activo: 1,
      createdAt: ts,
    });

  const [gf] = await db
    .select()
    .from(gastoFijo)
    .where(eq(gastoFijo.id, Number(result.insertId)))
    .limit(1);

  return c.json(gf, 201);
});

gastos.patch('/fijos/:id', zValidator('json', actualizarGastoFijoSchema), async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Id de gasto fijo inválido' }, 400);
  }

  const input = c.req.valid('json');
  const updateData: Record<string, unknown> = { ...input };

  if (input.activo !== undefined) {
    updateData.activo = input.activo ? 1 : 0;
  }

  await db
    .update(gastoFijo)
    .set(updateData)
    .where(eq(gastoFijo.id, id));

  const [gf] = await db
    .select()
    .from(gastoFijo)
    .where(eq(gastoFijo.id, id))
    .limit(1);

  if (!gf) return c.json({ error: 'Gasto fijo no encontrado' }, 404);
  return c.json(gf);
});

gastos.delete('/fijos/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Id de gasto fijo inválido' }, 400);
  }

  await db.delete(gastoFijo).where(eq(gastoFijo.id, id));
  return c.json({ ok: true });
});

// ==================== OTROS INGRESOS ====================

gastos.get('/ingresos', zValidator('query', listarOtrosIngresosQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const { q, desde, hasta, pagina = 1, porPagina = 25 } = query;

  const condiciones = [];
  if (desde) condiciones.push(gte(otroIngreso.fecha, new Date(desde + 'T00:00:00')));
  if (hasta) condiciones.push(lte(otroIngreso.fecha, new Date(hasta + 'T00:00:00')));

  const where = condiciones.length > 0 ? and(...condiciones) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(otroIngreso)
    .where(where);

  const filas = await db
    .select()
    .from(otroIngreso)
    .where(where)
    .orderBy(desc(otroIngreso.fecha), desc(otroIngreso.createdAt))
    .limit(porPagina)
    .offset((pagina - 1) * porPagina);

  return c.json({
    total: Number(total),
    pagina,
    porPagina,
    filas,
  });
});

gastos.post('/ingresos', zValidator('json', crearOtroIngresoSchema), async (c) => {
  const input = c.req.valid('json');
  const ts = nowSec();

  const [result] = await db
    .insert(otroIngreso)
    .values({
      fecha: new Date(input.fecha + 'T00:00:00'),
      monto: input.monto,
      descripcion: input.descripcion,
      origen: input.origen ?? null,
      createdAt: ts,
    });

  const [oi] = await db
    .select()
    .from(otroIngreso)
    .where(eq(otroIngreso.id, Number(result.insertId)))
    .limit(1);

  return c.json(oi, 201);
});

gastos.patch('/ingresos/:id', zValidator('json', actualizarOtroIngresoSchema), async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Id de ingreso inválido' }, 400);
  }

  const input = c.req.valid('json');
  const updateData: Record<string, unknown> = { ...input };

  if (input.fecha) {
    updateData.fecha = new Date(input.fecha + 'T00:00:00');
  }

  await db
    .update(otroIngreso)
    .set(updateData)
    .where(eq(otroIngreso.id, id));

  const [oi] = await db
    .select()
    .from(otroIngreso)
    .where(eq(otroIngreso.id, id))
    .limit(1);

  if (!oi) return c.json({ error: 'Ingreso no encontrado' }, 404);
  return c.json(oi);
});

gastos.delete('/ingresos/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Id de ingreso inválido' }, 400);
  }

  await db.delete(otroIngreso).where(eq(otroIngreso.id, id));
  return c.json({ ok: true });
});

// ==================== SERVIR BOLETAS ====================

gastos.get('/boletas/:sha256', async (c) => {
  const sha256 = c.req.param('sha256');
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    return c.json({ error: 'Hash inválido' }, 400);
  }

  let rutaAbsoluta = '';
  let mime = '';

  for (const ext of ['.pdf', '.png', '.jpg']) {
    const prueba = join(UPLOAD_DIR_BOLETAS, `${sha256}${ext}`);
    if (existsSync(prueba)) {
      rutaAbsoluta = prueba;
      mime = ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg';
      break;
    }
  }

  if (!rutaAbsoluta) {
    return c.json({ error: 'Archivo no encontrado' }, 404);
  }

  const file = await import('node:fs/promises').then((fs) => fs.readFile(rutaAbsoluta));
  return new Response(file, {
    headers: {
      'Content-Type': mime,
      'Content-Length': String(file.length),
      'Cache-Control': 'private, max-age=3600',
    },
  });
});