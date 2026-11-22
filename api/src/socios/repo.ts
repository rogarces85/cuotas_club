import { and, eq, like, or, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { clubSchema, montoCuotaPorTipo } from '@cuotas-club/shared';
import type { CrearSocioInput, ActualizarSocioInput, ListarSociosQuery } from '@cuotas-club/shared';

const { socio, socioEstadoHistorial, solicitudBecado } = clubSchema;

const nowSec = () => Math.floor(Date.now() / 1000);
const hoyISO = () => {
  const hoy = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${hoy.getFullYear()}-${dos(hoy.getMonth() + 1)}-${dos(hoy.getDate())}`;
};

/**
 * Construye el objeto de inserción para la tabla socio a partir de los datos de entrada.
 */
function buildSocioInsert(input: CrearSocioInput, ts: number) {
  const tipoCuota = input.tipoCuota ?? 'NORMAL';
  const montoCuota = input.montoCuota ?? montoCuotaPorTipo(tipoCuota);

  return {
    rut: input.rut,
    nombre: input.nombre,
    anio: input.anio,
    sexo: input.sexo ?? null,
    fechaNacimiento: input.fechaNacimiento ?? null,
    fechaIngreso: input.fechaIngreso ?? null,
    direccion: input.direccion ?? null,
    estado: input.estado ?? 'ACTIVO',
    tipoCuota,
    montoCuota,
    fechaCambioEstado: hoyISO(),
    fechaCambioTipoCuota: hoyISO(),
    motivoCambioTipoCuota: null,
    activo: 1,
    email: input.email || null,
    telefono: input.telefono ?? null,
    createdAt: ts,
    updatedAt: ts,
  } as typeof socio.$inferInsert;
}

/**
 * Construye el objeto de actualización para la tabla socio a partir de los datos de entrada.
 */
function buildSocioUpdate(input: ActualizarSocioInput, ts: number) {
  const setValues: Record<string, unknown> = {
    ...(input.rut !== undefined ? { rut: input.rut } : {}),
    ...(input.nombre !== undefined ? { nombre: input.nombre } : {}),
    ...(input.anio !== undefined ? { anio: input.anio } : {}),
    ...(input.sexo !== undefined ? { sexo: input.sexo } : {}),
    ...(input.fechaNacimiento !== undefined ? { fechaNacimiento: input.fechaNacimiento } : {}),
    ...(input.fechaIngreso !== undefined ? { fechaIngreso: input.fechaIngreso } : {}),
    ...(input.direccion !== undefined ? { direccion: input.direccion } : {}),
    ...(input.email !== undefined ? { email: input.email || null } : {}),
    ...(input.telefono !== undefined ? { telefono: input.telefono || null } : {}),
    updatedAt: ts,
  };

  if (input.tipoCuota !== undefined) {
    setValues.tipoCuota = input.tipoCuota;
    setValues.montoCuota = input.montoCuota ?? montoCuotaPorTipo(input.tipoCuota);
    setValues.fechaCambioTipoCuota = hoyISO();
    setValues.motivoCambioTipoCuota = input.motivoCambioTipoCuota ?? null;
  }

  return setValues as Record<string, unknown>;
}

export async function listarSocios(query: ListarSociosQuery) {
  const { q, estado, activo, pagina, porPagina } = query;

  const condiciones = [];

  if (q) {
    const patron = `%${q}%`;
    condiciones.push(or(like(socio.rut, patron), like(socio.nombre, patron))!);
  }
  if (estado) {
    condiciones.push(eq(socio.estado, estado));
  }
  if (activo !== undefined) {
    condiciones.push(eq(socio.activo, activo ? 1 : 0));
  }

  const where = condiciones.length > 0 ? and(...condiciones) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(socio)
    .where(where);

  const filas = await db
    .select()
    .from(socio)
    .where(where)
    .orderBy(sql`${socio.nombre} asc`)
    .limit(porPagina)
    .offset((pagina - 1) * porPagina);

  return {
    total: Number(total),
    pagina,
    porPagina,
    filas,
  };
}

export async function obtenerSocio(id: number) {
  const [fila] = await db.select().from(socio).where(eq(socio.id, id)).limit(1);
  return fila ?? null;
}

export async function socioPorRut(rut: string) {
  const [fila] = await db.select().from(socio).where(eq(socio.rut, rut)).limit(1);
  return fila ?? null;
}

export async function crearSocio(input: CrearSocioInput) {
  const ts = nowSec();
  const values = buildSocioInsert(input, ts);

  const [fila] = await db.insert(socio).values(values).$returningId();

  // Insertar en historial de cambios
  await db.insert(socioEstadoHistorial).values({
    socioId: fila.id,
    estadoAnterior: null,
    estadoNuevo: values.estado as string,
    tipoCuotaAnterior: null,
    tipoCuotaNuevo: values.tipoCuota as string,
    motivo: null,
    fecha: ts,
    usuarioId: null, // TODO: obtener del contexto de sesión
  });

  return obtenerSocio(fila.id);
}

export async function actualizarSocio(id: number, input: ActualizarSocioInput) {
  const ts = nowSec();
  const socioActual = await obtenerSocio(id);
  if (!socioActual) return null;

  const setValues = buildSocioUpdate(input, ts);

  // Determinar si hubo cambios en estado o tipo de cuota para el historial
  const estadoCambio = input.estado !== undefined && input.estado !== socioActual.estado;
  const tipoCuotaCambio =
    input.tipoCuota !== undefined && input.tipoCuota !== socioActual.tipoCuota;

  if (estadoCambio) {
    setValues.estado = input.estado;
    setValues.fechaCambioEstado = hoyISO();
  }

  await db.update(socio).set(setValues).where(eq(socio.id, id));

  // Insertar en historial si hubo cambios de estado o tipo de cuota
  if (estadoCambio || tipoCuotaCambio) {
    await db.insert(socioEstadoHistorial).values({
      socioId: id,
      estadoAnterior: socioActual.estado,
      estadoNuevo: input.estado ?? socioActual.estado,
      tipoCuotaAnterior: socioActual.tipoCuota,
      tipoCuotaNuevo: input.tipoCuota ?? socioActual.tipoCuota,
      motivo: input.motivoCambioTipoCuota ?? null,
      fecha: ts,
      usuarioId: null, // TODO: obtener del contexto de sesión
    });
  }

  return obtenerSocio(id);
}

/** Baja lógica: marca `activo = 0` y `estado = 'INACTIVO'`. Devuelve null si el socio no existe. */
export async function desactivarSocio(id: number) {
  const ts = nowSec();
  const socioActual = await obtenerSocio(id);
  if (!socioActual) return null;

  const result = await db
    .update(socio)
    .set({ activo: 0, estado: 'INACTIVO', fechaCambioEstado: hoyISO(), updatedAt: ts })
    .where(eq(socio.id, id));

  const affected = (result[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0;
  if (affected === 0) return null;

  await db.insert(socioEstadoHistorial).values({
    socioId: id,
    estadoAnterior: socioActual.estado,
    estadoNuevo: 'INACTIVO',
    tipoCuotaAnterior: socioActual.tipoCuota,
    tipoCuotaNuevo: socioActual.tipoCuota,
    motivo: null,
    fecha: ts,
    usuarioId: null,
  });

  return obtenerSocio(id);
}

/** Reactivar socio: marca `activo = 1` y `estado = 'ACTIVO'`. Devuelve null si el socio no existe. */
export async function reactivarSocio(id: number) {
  const ts = nowSec();
  const socioActual = await obtenerSocio(id);
  if (!socioActual) return null;

  const result = await db
    .update(socio)
    .set({ activo: 1, estado: 'ACTIVO', fechaCambioEstado: hoyISO(), updatedAt: ts })
    .where(eq(socio.id, id));

  const affected = (result[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0;
  if (affected === 0) return null;

  await db.insert(socioEstadoHistorial).values({
    socioId: id,
    estadoAnterior: socioActual.estado,
    estadoNuevo: 'ACTIVO',
    tipoCuotaAnterior: socioActual.tipoCuota,
    tipoCuotaNuevo: socioActual.tipoCuota,
    motivo: 'Reactivación de socio',
    fecha: ts,
    usuarioId: null,
  });

  return obtenerSocio(id);
}

/**
 * Obtiene socios que cumplen 60 años y no son becados, para que el tesorero
 * revise y apruebe/rechace el paso a Becado.
 */
export async function obtenerCandidatosBecado() {
  const hoy = new Date();

  const socios = await db
    .select({
      id: socio.id,
      rut: socio.rut,
      nombre: socio.nombre,
      fechaNacimiento: socio.fechaNacimiento,
      tipoCuota: socio.tipoCuota,
      estado: socio.estado,
    })
    .from(socio)
    .where(
      and(
        eq(socio.activo, 1),
        eq(socio.tipoCuota, 'NORMAL'), // Solo socios con tipo NORMAL pueden ser candidatos
      ),
    );

  // Filtrar en JS porque calcular edad con fecha de nacimiento requiere lógica
  const candidatos = (socios as typeof socio.$inferSelect[]).filter((s) => {
    if (!s.fechaNacimiento) return false;
    const [anio, mes, dia] = s.fechaNacimiento.split('-').map(Number);
    const fechaNac = new Date(anio, mes - 1, dia);
    const edad =
      hoy.getFullYear() -
      anio -
      (hoy.getMonth() + 1 < mes || (hoy.getMonth() + 1 === mes && hoy.getDate() < dia)
        ? 1
        : 0);
    return edad >= 60;
  });

  // Obtener solicitudes pendientes para no duplicar
  const pendientes = await db
    .select({ socioId: solicitudBecado.socioId, estado: solicitudBecado.estado })
    .from(solicitudBecado)
    .where(eq(solicitudBecado.estado, 'PENDIENTE'));

  const pendientesSet = new Set(pendientes.map((p) => p.socioId));

  return candidatos.filter((s) => !pendientesSet.has(s.id));
}

/**
 * Aprobar solicitud de becado: cambia tipoCuota a BECADO y montoCuota a 0.
 */
export async function aprobarBecado(socioId: number, usuarioId: string) {
  const ts = nowSec();
  const socioActual = await obtenerSocio(socioId);
  if (!socioActual) return null;

  await db
    .update(socio)
    .set({ tipoCuota: 'BECADO', montoCuota: 0, fechaCambioTipoCuota: hoyISO(), updatedAt: ts })
    .where(eq(socio.id, socioId));

  await db.insert(socioEstadoHistorial).values({
    socioId,
    estadoAnterior: socioActual.estado,
    estadoNuevo: socioActual.estado,
    tipoCuotaAnterior: socioActual.tipoCuota,
    tipoCuotaNuevo: 'BECADO',
    motivo: 'Becado por edad (60 años)',
    fecha: ts,
    usuarioId,
  });

  // Marcar solicitud como aprobada
  await db
    .update(solicitudBecado)
    .set({ estado: 'APROBADO', fechaResolucion: ts, usuarioId })
    .where(eq(solicitudBecado.socioId, socioId));

  return obtenerSocio(socioId);
}

/**
 * Rechazar solicitud de becado.
 */
export async function rechazarBecado(socioId: number, usuarioId: string) {
  const ts = nowSec();

  await db
    .update(solicitudBecado)
    .set({ estado: 'RECHAZADO', fechaResolucion: ts, usuarioId })
    .where(eq(solicitudBecado.socioId, socioId));

  return obtenerSocio(socioId);
}
