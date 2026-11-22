import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { clubSchema, cumpleanosQuerySchema } from '@cuotas-club/shared';
import { requireSession } from '../middleware/auth.js';
import { correoConfigurado, enviarCorreo } from '../mailer.js';
import {
  calcularEdadCumple,
  calcularMembresia,
  esCumpleHoy,
  parsePeriodo,
  periodoActual,
} from './calculo.js';
import { obtenerConfigClubCorreo } from './config.js';
import { renderizarSaludo } from './plantilla.js';

/**
 * Cumpleaños del mes y envío del saludo.
 *
 * GET  /api/cumpleanos                 — cumpleaños del mes actual
 * GET  /api/cumpleanos?mes=AAAA-MM     — un mes concreto
 * GET  /api/cumpleanos/:id/preview     — plantilla renderizada para un socio
 * POST /api/cumpleanos/:id/enviar      — envía el saludo y lo registra
 *
 * El envío es uno por socio y año: la tabla `felicitacion_cumpleanos` tiene
 * una clave única (socio, año) y el botón de la UI no permite duplicarlo.
 */

const { socio, felicitacionCumpleanos } = clubSchema;

export const cumpleanos = new Hono();

cumpleanos.use('*', requireSession);

cumpleanos.get('/', zValidator('query', cumpleanosQuerySchema), async (c) => {
  const { mes } = c.req.valid('query');
  const hoy = new Date();
  const periodo = parsePeriodo(mes, hoy);

  const filas = await db
    .select({
      socioId: socio.id,
      rut: socio.rut,
      nombre: socio.nombre,
      email: socio.email,
      fechaNacimiento: socio.fechaNacimiento,
      fechaIngreso: socio.fechaIngreso,
    })
    .from(socio)
    .where(
      and(
        eq(socio.activo, 1),
        isNotNull(socio.fechaNacimiento),
        sql`MONTH(${socio.fechaNacimiento}) = ${periodo.mes}`,
      ),
    )
    .orderBy(sql`DAY(${socio.fechaNacimiento}) asc`, sql`${socio.nombre} asc`);

  const ids = filas.map((fila) => fila.socioId);
  const felicitaciones =
    ids.length > 0
      ? await db
          .select()
          .from(felicitacionCumpleanos)
          .where(
            and(
              eq(felicitacionCumpleanos.anio, periodo.anio),
              inArray(felicitacionCumpleanos.socioId, ids),
            ),
          )
      : [];

  const club = await obtenerConfigClubCorreo();

  const salida = filas.map((fila) => {
    const fechaNacimiento = fila.fechaNacimiento ?? '';
    const esHoy =
      periodo.anio === hoy.getFullYear() &&
      periodo.mes === hoy.getMonth() + 1 &&
      esCumpleHoy(fechaNacimiento, hoy);
    const felicitacion =
      felicitaciones.find((f) => f.socioId === fila.socioId) ?? null;

    return {
      socioId: fila.socioId,
      rut: fila.rut,
      nombre: fila.nombre,
      email: fila.email,
      fechaNacimiento,
      dia: Number(fechaNacimiento.slice(8, 10)),
      edadCumple: calcularEdadCumple(fechaNacimiento, periodo.anio),
      fechaIngreso: fila.fechaIngreso,
      membresia: calcularMembresia(fila.fechaIngreso, hoy),
      esHoy,
      felicitacion: felicitacion
        ? { enviadoAt: felicitacion.enviadoAt, anio: felicitacion.anio }
        : null,
      puedeEnviar: Boolean(fila.email) && !felicitacion,
    };
  });

  return c.json({
    mes: periodo.clave,
    etiqueta: periodo.etiqueta,
    total: salida.length,
    conEmail: salida.filter((fila) => Boolean(fila.email)).length,
    enviados: salida.filter((fila) => Boolean(fila.felicitacion)).length,
    correoConfigurado: correoConfigurado(),
    club,
    filas: salida,
  });
});

cumpleanos.get('/:id/preview', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Id de socio inválido' }, 400);
  }

  const [fila] = await db.select().from(socio).where(eq(socio.id, id)).limit(1);
  if (!fila) return c.json({ error: 'Socio no encontrado' }, 404);
  if (!fila.fechaNacimiento) {
    return c.json({ error: 'El socio no tiene fecha de nacimiento registrada' }, 400);
  }

  const hoy = new Date();
  const club = await obtenerConfigClubCorreo();
  const saludo = renderizarSaludo({
    nombre: fila.nombre,
    edad: calcularEdadCumple(fila.fechaNacimiento, hoy.getFullYear()),
    esHoy: esCumpleHoy(fila.fechaNacimiento, hoy),
    membresia: calcularMembresia(fila.fechaIngreso, hoy),
    club,
  });

  return c.json({
    ...saludo,
    para: fila.email ?? '',
    nombre: fila.nombre,
  });
});

cumpleanos.post('/:id/enviar', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Id de socio inválido' }, 400);
  }

  const [fila] = await db.select().from(socio).where(eq(socio.id, id)).limit(1);
  if (!fila) return c.json({ error: 'Socio no encontrado' }, 404);
  if (fila.activo !== 1) {
    return c.json({ error: 'El socio está inactivo; no se le envía saludo' }, 400);
  }
  if (!fila.email) {
    return c.json({ error: 'El socio no tiene email registrado' }, 400);
  }
  if (!fila.fechaNacimiento) {
    return c.json({ error: 'El socio no tiene fecha de nacimiento registrada' }, 400);
  }

  const hoy = new Date();
  const periodo = periodoActual(hoy);
  const mesNacimiento = Number(fila.fechaNacimiento.slice(5, 7));
  if (mesNacimiento !== periodo.mes) {
    return c.json({ error: 'El socio no cumple años este mes' }, 400);
  }

  const [existente] = await db
    .select()
    .from(felicitacionCumpleanos)
    .where(
      and(
        eq(felicitacionCumpleanos.socioId, id),
        eq(felicitacionCumpleanos.anio, periodo.anio),
      ),
    )
    .limit(1);

  if (existente) {
    return c.json(
      {
        error: `El saludo de ${periodo.anio} ya se envió a este socio`,
        enviadoAt: existente.enviadoAt,
      },
      409,
    );
  }

  if (!correoConfigurado()) {
    return c.json(
      {
        error:
          'El envío de correos no está configurado. Agrega MAIL_PASSWORD (contraseña de aplicación de Gmail) en api/.env y reinicia la API.',
      },
      503,
    );
  }

  const club = await obtenerConfigClubCorreo();
  const saludo = renderizarSaludo({
    nombre: fila.nombre,
    edad: calcularEdadCumple(fila.fechaNacimiento, periodo.anio),
    esHoy: esCumpleHoy(fila.fechaNacimiento, hoy),
    membresia: calcularMembresia(fila.fechaIngreso, hoy),
    club,
  });

  const enviado = await enviarCorreo({
    to: fila.email,
    subject: saludo.asunto,
    text: saludo.texto,
    html: saludo.html,
  });

  if (!enviado) {
    return c.json(
      {
        error:
          'No se pudo enviar el correo. Revisa la configuración de Gmail (MAIL_PASSWORD) y vuelve a intentar.',
      },
      502,
    );
  }

  const enviadoAt = Math.floor(Date.now() / 1000);

  try {
    await db.insert(felicitacionCumpleanos).values({
      socioId: id,
      anio: periodo.anio,
      email: fila.email,
      enviadoAt,
    });
  } catch (err) {
    const codigo = (err as { code?: string }).code;
    if (codigo === 'ER_DUP_ENTRY') {
      return c.json(
        { error: 'El saludo ya se había enviado para este socio este año' },
        409,
      );
    }
    console.error('[cumpleanos] No se pudo registrar la felicitación:', err);
    return c.json({ error: 'El correo se envió, pero no se pudo registrar el envío' }, 500);
  }

  return c.json({ ok: true, enviadoAt, para: fila.email });
});
