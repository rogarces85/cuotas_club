import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { db, pool } from '../db/client.js';
import { clubSchema } from '@cuotas-club/shared';
import { calcularDeuda, crearPeriodo } from './repo.js';

/**
 * Pruebas de integración de `calcularDeuda` (AC4, AC5, AC7) contra la base de
 * descarte `osorno_runners_v2_test`. Siembra sus propios datos y limpia.
 */

const { socio, nivelCuota, periodoCuota, pagoMes } = clubSchema;

const RUT_A = '11111111';
const RUT_B = '22222222';
const RUT_C = '33333333'; // será inactivo
const RUT_D = '44444444'; // pagará el período
const RUT_E = '55555555'; // sin nivel de cuota
const PERIODO = '2098-01';

async function limpiar() {
  await db.delete(pagoMes).where(sql`id_pago >= 900000`);
  await db.delete(socio).where(
    sql`rut IN (${RUT_A}, ${RUT_B}, ${RUT_C}, ${RUT_D}, ${RUT_E})`,
  );
  await db.delete(periodoCuota).where(sql`periodo = ${PERIODO}`);
  await db.delete(nivelCuota).where(sql`tipo IN ('ACTIVO', 'MEMBRESIA', 'BECADO') OR codigo = 'ACTIVO2'`);
}

beforeAll(async () => {
  await limpiar();

  // Niveles de cuota
  await db.insert(nivelCuota).values([
    { codigo: 'ACTIVO', nombre: 'Activo', montoClp: 15000, tipo: 'ACTIVO', activo: 1 },
    { codigo: 'MEMBRESIA', nombre: 'Membresía', montoClp: 10000, tipo: 'MEMBRESIA', activo: 1 },
    { codigo: 'BECADO', nombre: 'Becado', montoClp: 0, tipo: 'BECADO', activo: 1 },
  ]);

  // Socios: A, B activos; C inactivo; D activo (pagará)
  const ts = Math.floor(Date.now() / 1000);
  await db.insert(socio).values([
    { rut: RUT_A, nombre: 'Socio A', anio: 2026, estado: 'ACTIVO', activo: 1, createdAt: ts, updatedAt: ts },
    { rut: RUT_B, nombre: 'Socio B', anio: 2026, estado: 'MEMBRESIA', activo: 1, createdAt: ts, updatedAt: ts },
    { rut: RUT_C, nombre: 'Socio C', anio: 2026, estado: 'ACTIVO', activo: 0, createdAt: ts, updatedAt: ts },
    { rut: RUT_D, nombre: 'Socio D', anio: 2026, estado: 'ACTIVO', activo: 1, createdAt: ts, updatedAt: ts },
  ]);

  // Período
  await crearPeriodo({ periodo: PERIODO, diaVencimiento: 10 });

  // Socio D ya pagó el período (pago_mes)
  const [d] = await db.select({ id: socio.id }).from(socio).where(sql`rut = ${RUT_D}`);
  const [p] = await db.select({ id: periodoCuota.id }).from(periodoCuota).where(sql`periodo = ${PERIODO}`);
  // No existe tabla pago aún en tests; usamos pago_mes con id_pago ficticio.
  await db.insert(pagoMes).values({
    pagoId: 900001,
    socioId: d.id,
    rut: RUT_D,
    periodo: PERIODO,
    createdAt: ts,
  });
});

afterAll(async () => {
  await limpiar();
  await pool.end();
});

describe('calcularDeuda (AC4, AC5, AC7)', () => {
  it('lista solo socios activos sin pago, con su monto por tipo', async () => {
    const [p] = await db.select({ id: periodoCuota.id }).from(periodoCuota).where(sql`periodo = ${PERIODO}`);
    const deuda = await calcularDeuda(p.id);

    const ruts = deuda.filas.map((f) => f.rut);

    // AC4: A (ACTIVO) y B (MEMBRESIA) deben; D pagó → excluido (AC7); C inactivo → excluido (AC5).
    expect(ruts.sort()).toEqual([RUT_A, RUT_B].sort());
    expect(deuda.total).toBe(2);

    // Monto por tipo: A=15000, B=10000
    const porRut = Object.fromEntries(deuda.filas.map((f) => [f.rut, f.montoClp]));
    expect(porRut[RUT_A]).toBe(15000);
    expect(porRut[RUT_B]).toBe(10000);
  });

  it('no duplica un socio cuando hay niveles duplicados por tipo', async () => {
    // Rompe la invariante a propósito: segundo nivel ACTIVO activo.
    await db.insert(nivelCuota).values({
      codigo: 'ACTIVO2',
      nombre: 'Activo duplicado',
      montoClp: 99999,
      tipo: 'ACTIVO',
      activo: 1,
    });

    const [p] = await db.select({ id: periodoCuota.id }).from(periodoCuota).where(sql`periodo = ${PERIODO}`);
    const deuda = await calcularDeuda(p.id);

    // El socio A (ACTIVO) debe aparecer una sola vez, con monto mínimo (15000).
    const filasA = deuda.filas.filter((f) => f.rut === RUT_A);
    expect(filasA.length).toBe(1);
    expect(filasA[0].montoClp).toBe(15000);

    // Limpiar el nivel duplicado
    await db.delete(nivelCuota).where(sql`codigo = 'ACTIVO2'`);
  });

  it('un socio activo sin nivel de cuota queda con monto 0 (no rompe)', async () => {
    await db.insert(socio).values({
      rut: RUT_E,
      nombre: 'Socio Sin Nivel',
      anio: 2026,
      estado: 'SIN_NIVEL',
      activo: 1,
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    });

    const [p] = await db.select({ id: periodoCuota.id }).from(periodoCuota).where(sql`periodo = ${PERIODO}`);
    const deuda = await calcularDeuda(p.id);
    const sinNivel = deuda.filas.find((f) => f.rut === RUT_E);
    expect(sinNivel).toBeDefined();
    expect(sinNivel!.montoClp).toBe(0);

    await db.delete(socio).where(sql`rut = ${RUT_E}`);
  });
});
