import { and, eq, sql, isNull, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { clubSchema } from '@cuotas-club/shared';
import type { CrearPagoInput, ListarPagosQuery } from '@cuotas-club/shared';

/**
 * Acceso a pagos y comprobantes.
 *
 * Reglas:
 * - El estado de un pago va de PENDIENTE → APROBADO | RECHAZADO
 * - La deuda de un socio se deriva: períodos de cuota vigentes sin pago aprobado
 */

const { pago, pagoMes, comprobante, socio, periodoCuota, nivelCuota } = clubSchema;

const nowSec = () => Math.floor(Date.now() / 1000);

export type PagoRow = typeof pago.$inferSelect;

export async function listarPagos(query: ListarPagosQuery) {
  const { estado, socioId, pagina = 1, porPagina = 25 } = query;

  const condiciones = [];
  if (estado) condiciones.push(eq(pago.estado, estado));
  if (socioId) condiciones.push(eq(pago.socioId, socioId));

  const where = condiciones.length > 0 ? and(...condiciones) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(pago)
    .where(where);

  const filas = await db
    .select({
      id: pago.id,
      rut: pago.rut,
      nombreSnapshot: pago.nombreSnapshot,
      anio: pago.anio,
      estado: pago.estado,
      fechaPago: pago.fechaPago,
      totalPago: pago.totalPago,
      valorCuota: pago.valorCuota,
      tipoCuota: pago.tipoCuota,
      mesesCantidad: pago.mesesCantidad,
      origen: pago.origen,
      createdAt: pago.createdAt,
    })
    .from(pago)
    .where(where)
    .orderBy(desc(pago.createdAt))
    .limit(porPagina)
    .offset((pagina - 1) * porPagina);

  return {
    total: Number(total),
    pagina,
    porPagina,
    filas,
  };
}

export async function obtenerPago(id: number) {
  const [fila] = await db
    .select({
      id: pago.id,
      rut: pago.rut,
      nombreSnapshot: pago.nombreSnapshot,
      anio: pago.anio,
      sexo: pago.sexo,
      estado: pago.estado,
      situacion: pago.situacion,
      fechaPago: pago.fechaPago,
      totalPago: pago.totalPago,
      valorCuota: pago.valorCuota,
      tipoCuota: pago.tipoCuota,
      mesesCantidad: pago.mesesCantidad,
      mesesDetalle: pago.mesesDetalle,
      observacion: pago.observacion,
      origen: pago.origen,
      createdAt: pago.createdAt,
    })
    .from(pago)
    .where(eq(pago.id, id))
    .limit(1);

  if (!fila) return null;

  const comps = await db
    .select({
      id: comprobante.id,
      ruta: comprobante.ruta,
      mime: comprobante.mime,
      bytes: comprobante.bytes,
      sha256: comprobante.sha256,
      estado: comprobante.estado,
      createdAt: comprobante.createdAt,
    })
    .from(comprobante)
    .where(eq(comprobante.pagoId, id));

  return { ...fila, comprobantes: comps };
}

export async function crearPago(input: CrearPagoInput) {
  const ts = nowSec();
  const [result] = await db
    .insert(pago)
    .values({
      socioId: input.socioId,
      rut: input.rut,
      nombreSnapshot: input.nombreSnapshot,
      anio: input.anio,
      sexo: input.sexo ?? null,
      estado: input.estado ?? 'PENDIENTE',
      situacion: input.situacion ?? null,
      fechaPago: new Date(input.fechaPago + 'T00:00:00'),
      totalPago: input.totalPago,
      valorCuota: input.valorCuota,
      tipoCuota: input.tipoCuota,
      mesesCantidad: input.mesesCantidad,
      mesesDetalle: input.mesesDetalle ?? null,
      observacion: input.observacion ?? null,
      origen: input.origen ?? 'manual',
      createdAt: ts,
      updatedAt: ts,
    });

  return obtenerPago(Number(result.id));
}

export async function aprobarPago(id: number) {
  await db
    .update(pago)
    .set({ estado: 'APROBADO', updatedAt: nowSec() })
    .where(eq(pago.id, id));

  return obtenerPago(id);
}

export async function rechazarPago(id: number, motivo?: string) {
  await db
    .update(pago)
    .set({ estado: 'RECHAZADO', situacion: motivo ?? null, updatedAt: nowSec() })
    .where(eq(pago.id, id));

  return obtenerPago(id);
}

/**
 * Deuda de un socio: períodos de cuota vigentes sin pago aprobado.
 * Se deriva del padrón vivo, no es una tabla almacenada.
 */
export async function deudaSocio(socioId: number) {
  const [s] = await db.select().from(socio).where(eq(socio.id, socioId)).limit(1);
  if (!s) return null;

  // Períodos de cuota existentes
  const periodos = await db.select().from(periodoCuota).orderBy(periodoCuota.periodo);

  // Pagos aprobados de este socio
  const pagosAprobados = await db
    .select({ periodo: pagoMes.periodo })
    .from(pagoMes)
    .innerJoin(pago, eq(pagoMes.pagoId, pago.id))
    .where(and(eq(pagoMes.socioId, socioId), eq(pago.estado, 'APROBADO')));

  const periodosPagados = new Set(pagosAprobados.map((p) => p.periodo));

  const deudores = periodos
    .filter((p) => !periodosPagados.has(p.periodo))
    .map((p) => ({
      periodo: p.periodo,
      diaVencimiento: p.diaVencimiento,
    }));

  return {
    socioId: s.id,
    rut: s.rut,
    nombre: s.nombre,
    estado: s.estado,
    activo: s.activo,
    totalDeuda: deudores.length,
    periodos: deudores,
  };
}

export async function listarMorosos() {
  const socios = await db
    .select({
      id: socio.id,
      rut: socio.rut,
      nombre: socio.nombre,
      estado: socio.estado,
      activo: socio.activo,
    })
    .from(socio)
    .where(eq(socio.activo, 1));

  const morosos = [];
  for (const s of socios) {
    const deuda = await deudaSocio(s.id);
    if (deuda && deuda.totalDeuda > 0) {
      morosos.push({
        socioId: s.id,
        rut: s.rut,
        nombre: s.nombre,
        estado: s.estado,
        totalDeuda: deuda.totalDeuda,
        periodos: deuda.periodos,
      });
    }
  }

  return morosos.sort((a, b) => b.totalDeuda - a.totalDeuda);
}
