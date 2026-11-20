import { and, eq, sql, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { clubSchema } from '@cuotas-club/shared';
import type { CrearPeriodoCuotaInput } from '@cuotas-club/shared';

/**
 * Acceso a períodos de cuota y al cálculo de deuda.
 *
 * La deuda NO es una tabla: es una consulta derivada del padrón vivo.
 * Un socio debe la cuota de un período si:
 *   - está activo (`socio.activo = 1`), y
 *   - no tiene `pago_mes` para ese período.
 * El monto se toma de `nivel_cuota` según `socio.estado` (mapeo estado→tipo).
 */

const { periodoCuota, socio, nivelCuota, pagoMes } = clubSchema;

const nowSec = () => Math.floor(Date.now() / 1000);

export type PeriodoCuotaRow = typeof periodoCuota.$inferSelect;

export type DeudaFila = {
  socioId: number;
  rut: string;
  nombre: string;
  tipo: string;
  montoClp: number;
};

export async function listarPeriodos() {
  const periodos = await db
    .select()
    .from(periodoCuota)
    .orderBy(sql`${periodoCuota.periodo} desc`);

  // Para cada período, cuenta deudores (consulta derivada).
  const conDeudores = await Promise.all(
    periodos.map(async (p) => {
      const { total } = await calcularDeuda(p.id);
      return { ...p, totalDeudores: total };
    }),
  );

  return conDeudores;
}

export async function obtenerPeriodo(id: number) {
  const [fila] = await db.select().from(periodoCuota).where(eq(periodoCuota.id, id)).limit(1);
  return fila ?? null;
}

export async function periodoPorMes(periodo: string) {
  const [fila] = await db
    .select()
    .from(periodoCuota)
    .where(eq(periodoCuota.periodo, periodo))
    .limit(1);
  return fila ?? null;
}

export async function crearPeriodo(input: CrearPeriodoCuotaInput) {
  const [result] = await db
    .insert(periodoCuota)
    .values({
      periodo: input.periodo,
      diaVencimiento: input.diaVencimiento,
      createdAt: nowSec(),
    });

  return obtenerPeriodo(Number(result.insertId));
}

/**
 * Deuda de un período: socios activos sin pago para ese mes, con su monto.
 * El monto sale de `nivel_cuota` por `socio.estado`; si un socio activo no
 * tiene nivel correspondiente, queda con monto 0 (no rompe el listado).
 */
/**
 * Deuda de un período: socios activos sin pago para ese mes, con su monto.
 * El monto sale de `nivel_cuota` por `socio.estado`; si un socio activo no
 * tiene nivel correspondiente, queda con monto 0 (no rompe el listado).
 *
 * Invariante del modelo: un solo nivel activo por `tipo`. Para ser robusto
 * ante datos que la rompan (dos niveles ACTIVO activos), el JOIN usa una
 * subconsulta que deduplica por tipo (monto mínimo determinístico), de modo
 * que cada socio aparece a lo sumo una vez (sin duplicar la deuda).
 */
export async function calcularDeuda(periodoId: number) {
  const periodo = await obtenerPeriodo(periodoId);
  if (!periodo) return { periodo: null, total: 0, filas: [] as DeudaFila[] };

  // GROUP BY + MIN deduplica niveles si hay más de uno activo por tipo.
  const filas = await db
    .select({
      socioId: socio.id,
      rut: socio.rut,
      nombre: socio.nombre,
      tipo: socio.estado,
      montoClp: sql<number>`COALESCE(MIN(${nivelCuota.montoClp}), 0)`,
    })
    .from(socio)
    .leftJoin(
      nivelCuota,
      and(eq(nivelCuota.tipo, socio.estado), eq(nivelCuota.activo, 1)),
    )
    .leftJoin(
      pagoMes,
      and(eq(pagoMes.socioId, socio.id), eq(pagoMes.periodo, periodo.periodo)),
    )
    .where(and(eq(socio.activo, 1), isNull(pagoMes.id)))
    .groupBy(socio.id, socio.rut, socio.nombre, socio.estado);

  return {
    periodo: periodo.periodo,
    total: filas.length,
    filas: filas.map((f) => ({
      socioId: f.socioId,
      rut: f.rut,
      nombre: f.nombre,
      tipo: f.tipo,
      montoClp: Number(f.montoClp),
    })),
  };
}
