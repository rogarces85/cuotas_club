import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  crearSocioSchema,
  actualizarSocioSchema,
  listarSociosQuerySchema,
} from '@cuotas-club/shared';
import { requireSession } from '../middleware/auth.js';
import { listarPagos, deudaSocio } from '../pagos/repo.js';
import {
  listarSocios,
  obtenerSocio,
  socioPorRut,
  crearSocio,
  actualizarSocio,
  desactivarSocio,
} from './repo.js';
import {
  ErrorImportacion,
  generarPlantillaSocios,
  importarDesdeFormData,
} from './import.js';

/**
 * Rutas de socios. Todas exigen sesión válida (requireSession).
 * Ver el documento FTD 02-DOCS/wiki/ftd/m1-socios.md.
 */

export const socios = new Hono();

socios.use('*', requireSession);

// GET /api/socios — listado con búsqueda, filtro y paginación.
socios.get('/', zValidator('query', listarSociosQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const resultado = await listarSocios(query);
  return c.json(resultado);
});

// GET /api/socios/plantilla — plantilla Excel limpia para la importación masiva.
// Debe declararse antes de `/:id` para que "plantilla" no se lea como un id.
socios.get('/plantilla', (c) => {
  const buffer = generarPlantillaSocios();
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-socios-osorno-runners.xlsx"',
      'Content-Length': String(buffer.length),
      'Cache-Control': 'no-store',
    },
  });
});

// POST /api/socios/importar — alta/actualización masiva desde .xlsx, .xls o .csv.
// Acepta `dryRun=true` para validar y previsualizar sin escribir en la base.
socios.post('/importar', async (c) => {
  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: 'Se esperaba un formulario multipart con el campo "archivo"' }, 400);
  }

  try {
    const resultado = await importarDesdeFormData(formData);
    return c.json(resultado);
  } catch (err) {
    if (err instanceof ErrorImportacion) {
      return c.json(
        { error: err.message, detalleErrores: err.detalle },
        err.detalle.length > 0 ? 422 : 400,
      );
    }
    console.error('[socios] importación fallida:', err);
    return c.json({ error: 'No se pudo procesar la importación' }, 500);
  }
});

// GET /api/socios/:id — ficha de un socio.
socios.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Id de socio inválido' }, 400);
  }
  const socio = await obtenerSocio(id);
  if (!socio) return c.json({ error: 'Socio no encontrado' }, 404);
  return c.json(socio);
});

// GET /api/socios/:id/ficha — ficha completa: datos, pagos y deuda derivada.
socios.get('/:id/ficha', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Id de socio inválido' }, 400);
  }

  const socio = await obtenerSocio(id);
  if (!socio) return c.json({ error: 'Socio no encontrado' }, 404);

  const [pagos, deuda] = await Promise.all([
    listarPagos({ socioId: id, pagina: 1, porPagina: 50 }),
    deudaSocio(id),
  ]);

  return c.json({
    socio,
    pagos: pagos.filas,
    deuda,
  });
});

// POST /api/socios — alta.
socios.post('/', zValidator('json', crearSocioSchema), async (c) => {
  const input = c.req.valid('json');

  const existente = await socioPorRut(input.rut);
  if (existente) {
    return c.json({ error: `Ya existe un socio con el RUT ${input.rut}` }, 409);
  }

  const socio = await crearSocio(input);
  return c.json(socio, 201);
});

// PATCH /api/socios/:id — edición parcial.
socios.patch('/:id', zValidator('json', actualizarSocioSchema), async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Id de socio inválido' }, 400);
  }

  const actual = await obtenerSocio(id);
  if (!actual) return c.json({ error: 'Socio no encontrado' }, 404);

  const input = c.req.valid('json');
  if (input.rut && input.rut !== actual.rut) {
    const otro = await socioPorRut(input.rut);
    if (otro) {
      return c.json({ error: `Ya existe un socio con el RUT ${input.rut}` }, 409);
    }
  }

  const socio = await actualizarSocio(id, input);
  return c.json(socio);
});

// DELETE /api/socios/:id — baja lógica (activo = 0).
socios.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Id de socio inválido' }, 400);
  }

  const socio = await desactivarSocio(id);
  if (!socio) return c.json({ error: 'Socio no encontrado o ya inactivo' }, 404);
  return c.json(socio);
});
