import { and, eq, like, or, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { clubSchema } from '@cuotas-club/shared';
import type { CrearSocioInput, ActualizarSocioInput, ListarSociosQuery } from '@cuotas-club/shared';

/**
 * Acceso a la tabla `socio`.
 *
 * Reglas:
 * - El RUT llega normalizado (sin puntos ni guion, K mayúscula) porque el
 *   validador lo garantiza; aquí solo se guarda.
 * - `created_at` / `updated_at` son int (epoch segundos), como el resto del
 *   esquema del club.
 * - La baja es lógica: `activo = 0`. Nunca se borra un socio con historial.
 */

const { socio } = clubSchema;

const nowSec = () => Math.floor(Date.now() / 1000);

export type SocioRow = typeof socio.$inferSelect;

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
  const [fila] = await db
    .insert(socio)
    .values({
      rut: input.rut,
      nombre: input.nombre,
      anio: input.anio,
      sexo: input.sexo ?? null,
      fechaNacimiento: input.fechaNacimiento ?? null,
      fechaIngreso: input.fechaIngreso ?? null,
      direccion: input.direccion ?? null,
      estado: input.estado ?? 'ACTIVO',
      activo: 1,
      email: input.email || null,
      telefono: input.telefono ?? null,
      createdAt: ts,
      updatedAt: ts,
    })
    .$returningId();

  return obtenerSocio(fila.id);
}

export async function actualizarSocio(id: number, input: ActualizarSocioInput) {
  const ts = nowSec();
  await db
    .update(socio)
    .set({
      ...(input.rut !== undefined ? { rut: input.rut } : {}),
      ...(input.nombre !== undefined ? { nombre: input.nombre } : {}),
      ...(input.anio !== undefined ? { anio: input.anio } : {}),
      // `sexo`, `fechaNacimiento`, `fechaIngreso` y `direccion` llegan
      // normalizados por el validador: null significa "borrar el dato".
      ...(input.sexo !== undefined ? { sexo: input.sexo } : {}),
      ...(input.fechaNacimiento !== undefined ? { fechaNacimiento: input.fechaNacimiento } : {}),
      ...(input.fechaIngreso !== undefined ? { fechaIngreso: input.fechaIngreso } : {}),
      ...(input.direccion !== undefined ? { direccion: input.direccion } : {}),
      ...(input.estado !== undefined ? { estado: input.estado } : {}),
      ...(input.email !== undefined ? { email: input.email || null } : {}),
      ...(input.telefono !== undefined ? { telefono: input.telefono || null } : {}),
      updatedAt: ts,
    })
    .where(eq(socio.id, id));

  return obtenerSocio(id);
}

/** Baja lógica: marca `activo = 0`. Devuelve null si el socio no existe. */
export async function desactivarSocio(id: number) {
  const ts = nowSec();
  const result = await db
    .update(socio)
    .set({ activo: 0, updatedAt: ts })
    .where(and(eq(socio.id, id), eq(socio.activo, 1)));

  // drizzle mysql2: result[0].affectedRows para operaciones sin returning.
  const affected = (result[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0;
  if (affected === 0) return null;
  return obtenerSocio(id);
}
