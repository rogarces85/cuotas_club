import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { inArray } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import { db } from '../db/client.js';
import { clubSchema } from '@cuotas-club/shared';
import {
  ErrorReporte,
  interpretarFiltrosSocios,
  obtenerPagosParaExportar,
  obtenerReporteSocios,
  resolverPeriodo,
} from './socios-service.js';
import { generarCsvPagos, generarXlsxPagos } from './socios-export.js';

/**
 * Pruebas del Service Layer de reportes.
 *
 * - Funciones puras: período, filtros y formato de archivos.
 * - Integración contra la base de descarte: siembra 4 socios y 6 pagos, consulta
 *   las métricas y limpia al final.
 */

const { socio, pago } = clubSchema;

const RUTS = ['99000001', '99000002', '99000003', '99000004'];

let ids: Record<string, number> = {};

async function limpiar() {
  await db.delete(pago).where(inArray(pago.rut, RUTS));
  await db.delete(socio).where(inArray(socio.rut, RUTS));
}

beforeAll(async () => {
  await limpiar();
  const ts = Math.floor(Date.now() / 1000);

  const insertados = await db
    .insert(socio)
    .values([
      {
        rut: '99000001',
        nombre: 'Reporte Hombre Activo',
        anio: 2026,
        sexo: 'HOMBRE',
        fechaNacimiento: '1990-03-15',
        fechaIngreso: '2020-01-10',
        estado: 'ACTIVO',
        activo: 1,
        email: 'reporte.a@test.cl',
        createdAt: ts,
        updatedAt: ts,
      },
      {
        rut: '99000002',
        nombre: 'Reporte Mujer Activa',
        anio: 2026,
        sexo: 'MUJER',
        fechaNacimiento: '2000-06-20',
        fechaIngreso: '2025-06-01',
        estado: 'MEMBRESIA',
        activo: 1,
        email: 'reporte.b@test.cl',
        createdAt: ts,
        updatedAt: ts,
      },
      {
        rut: '99000003',
        nombre: 'Reporte Mujer Inactiva',
        anio: 2026,
        sexo: 'MUJER',
        fechaNacimiento: '1970-01-01',
        fechaIngreso: '2015-01-01',
        estado: 'BECADO',
        activo: 0,
        email: 'reporte.c@test.cl',
        createdAt: ts,
        updatedAt: ts,
      },
      {
        rut: '99000004',
        nombre: 'Reporte Sin Datos',
        anio: 2026,
        sexo: null,
        fechaNacimiento: null,
        fechaIngreso: '2026-02-01',
        estado: 'ACTIVO',
        activo: 1,
        email: null,
        createdAt: ts,
        updatedAt: ts,
      },
    ])
    .$returningId();

  ids = {
    '99000001': insertados[0].id,
    '99000002': insertados[1].id,
    '99000003': insertados[2].id,
    '99000004': insertados[3].id,
  };

  const pagos = [
    { rut: '99000001', socioId: ids['99000001'], fecha: new Date(2026, 2, 15), total: 10000, estado: 'APROBADO' },
    { rut: '99000001', socioId: ids['99000001'], fecha: new Date(2026, 5, 15), total: 15000, estado: 'APROBADO' },
    { rut: '99000001', socioId: ids['99000001'], fecha: new Date(2026, 3, 1), total: 2000, estado: 'PENDIENTE' },
    { rut: '99000001', socioId: ids['99000001'], fecha: new Date(2025, 11, 15), total: 5000, estado: 'APROBADO' },
    { rut: '99000002', socioId: ids['99000002'], fecha: new Date(2026, 3, 10), total: 8000, estado: 'PENDIENTE' },
    { rut: '99000003', socioId: ids['99000003'], fecha: new Date(2026, 4, 1), total: 3000, estado: 'APROBADO' },
  ];

  await db.insert(pago).values(
    pagos.map((p) => ({
      socioId: p.socioId,
      rut: p.rut,
      nombreSnapshot: 'Snapshot',
      anio: 2026,
      estado: p.estado,
      fechaPago: p.fecha,
      totalPago: p.total,
      valorCuota: p.total,
      tipoCuota: 'ACTIVO' as const,
      mesesCantidad: 1,
      mesesDetalle: '2026-03',
      origen: 'manual' as const,
      createdAt: ts,
      updatedAt: ts,
    })),
  );
});

afterAll(async () => {
  await limpiar();
});

describe('resolverPeriodo', () => {
  const hoy = new Date(2026, 10, 21);

  it('resuelve un año completo', () => {
    const periodo = resolverPeriodo({ periodo: 'ANIO', anio: 2026 }, hoy);
    expect(periodo.clave).toBe('2026');
    expect(periodo.etiqueta).toBe('Año 2026');
    expect(periodo.inicio).toBe('2026-01-01');
    expect(periodo.fin).toBe('2026-12-31');
    expect(periodo.meses).toHaveLength(12);
  });

  it('resuelve un trimestre con rango semiabierto', () => {
    const periodo = resolverPeriodo({ periodo: 'TRIMESTRE', anio: 2026, trimestre: 4 }, hoy);
    expect(periodo.clave).toBe('2026-T4');
    expect(periodo.etiqueta).toBe('Cuarto trimestre 2026');
    expect(periodo.inicio).toBe('2026-10-01');
    expect(periodo.fin).toBe('2026-12-31');
    expect(periodo.meses).toEqual(['2026-10', '2026-11', '2026-12']);
  });

  it('resuelve un mes y usa el mes actual por defecto', () => {
    const febrero = resolverPeriodo({ periodo: 'MES', anio: 2026, mes: 2 }, hoy);
    expect(febrero.inicio).toBe('2026-02-01');
    expect(febrero.fin).toBe('2026-02-28');
    expect(febrero.meses).toEqual(['2026-02']);

    const actual = resolverPeriodo({ periodo: 'TRIMESTRE', anio: 2026 }, hoy);
    expect(actual.trimestre).toBe(4);
  });

  it('rechaza años fuera de rango', () => {
    expect(() => resolverPeriodo({ periodo: 'ANIO', anio: 1999 }, hoy)).toThrow(ErrorReporte);
  });
});

describe('interpretarFiltrosSocios', () => {
  it('convierte Activos y Hombres en filtros tipados', () => {
    const filtros = interpretarFiltrosSocios(['Activos', 'Hombres']);
    expect(filtros.activo).toBe(true);
    expect(filtros.estados).toEqual([]);
    expect(filtros.sexos).toEqual(['HOMBRE']);
    expect(filtros.etiquetas).toEqual(['Activos', 'Hombres']);
  });

  it('acepta tildes, plurales y estados', () => {
    const filtros = interpretarFiltrosSocios(['Membresía', 'Becados', 'Mujeres']);
    expect(filtros.estados.sort()).toEqual(['BECADO', 'MEMBRESIA']);
    expect(filtros.sexos).toEqual(['MUJER']);
  });

  it('rechaza filtros contradictorios o desconocidos', () => {
    expect(() => interpretarFiltrosSocios(['Activos', 'Inactivos'])).toThrow(/a la vez/i);
    expect(() => interpretarFiltrosSocios(['Marcianos'])).toThrow(/desconocido/i);
  });
});

describe('reporte de socios (integración)', () => {
  it('agrega el padrón y la recaudación del año', async () => {
    const reporte = await obtenerReporteSocios({ periodo: 'ANIO', anio: 2026, socios: [] });

    expect(reporte.resumen.totalSocios).toBe(4);
    expect(reporte.resumen.activos).toBe(3);
    expect(reporte.resumen.inactivos).toBe(1);
    expect(reporte.resumen.conEmail).toBe(3);
    expect(reporte.resumen.sinEmail).toBe(1);
    expect(reporte.resumen.conFechaNacimiento).toBe(3);
    expect(reporte.resumen.conFechaIngreso).toBe(4);
    expect(reporte.resumen.recaudacionPeriodo).toBe(28000);
    expect(reporte.resumen.pagosAprobados).toBe(3);
    expect(reporte.resumen.sociosPagadores).toBe(2);

    expect(reporte.porSexo.find((f) => f.clave === 'HOMBRE')?.total).toBe(1);
    expect(reporte.porSexo.find((f) => f.clave === 'MUJER')?.total).toBe(2);
    expect(reporte.porSexo.find((f) => f.clave === 'SIN_DATO')?.total).toBe(1);
    expect(reporte.porEstado.find((f) => f.clave === 'ACTIVO')?.total).toBe(2);
    expect(reporte.porEstado.find((f) => f.clave === 'MEMBRESIA')?.total).toBe(1);
    expect(reporte.porEstado.find((f) => f.clave === 'BECADO')?.total).toBe(1);

    const febrero = reporte.nuevosPorMes.find((m) => m.clave === '2026-02');
    expect(febrero?.total).toBe(1);

    const marzo = reporte.pagos.porMes.find((m) => m.clave === '2026-03');
    expect(marzo?.monto).toBe(10000);
    const mayo = reporte.pagos.porMes.find((m) => m.clave === '2026-05');
    expect(mayo?.monto).toBe(3000);
  });

  it('aplica filtros demográficos a padrón y pagos', async () => {
    const hombresActivos = await obtenerReporteSocios({
      periodo: 'ANIO',
      anio: 2026,
      socios: ['Activos', 'Hombres'],
    });
    expect(hombresActivos.resumen.totalSocios).toBe(1);
    expect(hombresActivos.resumen.recaudacionPeriodo).toBe(25000);
    expect(hombresActivos.resumen.pagosAprobados).toBe(2);

    const inactivos = await obtenerReporteSocios({
      periodo: 'ANIO',
      anio: 2026,
      socios: ['Inactivos'],
    });
    expect(inactivos.resumen.totalSocios).toBe(1);
    expect(inactivos.resumen.recaudacionPeriodo).toBe(3000);
  });

  it('no incluye pagos pendientes en la recaudación', async () => {
    const mujeres = await obtenerReporteSocios({
      periodo: 'ANIO',
      anio: 2026,
      socios: ['Mujeres'],
    });
    // B tiene un pago PENDIENTE; C tiene uno APROBADO.
    expect(mujeres.resumen.totalSocios).toBe(2);
    expect(mujeres.resumen.pagosAprobados).toBe(1);
    expect(mujeres.resumen.recaudacionPeriodo).toBe(3000);
  });
});

describe('exportación de pagos', () => {
  it('filtra por año, socios y estado de pago', async () => {
    const todos = await obtenerPagosParaExportar({ anio: 2026, socios: [], estadoPago: 'TODOS' });
    expect(todos.filas).toHaveLength(5);

    const aprobados = await obtenerPagosParaExportar({
      anio: 2026,
      socios: [],
      estadoPago: 'APROBADO',
    });
    expect(aprobados.filas).toHaveLength(3);
    expect(aprobados.resumen.montoTotal).toBe(28000);

    const activos = await obtenerPagosParaExportar({
      anio: 2026,
      socios: ['Activos'],
      estadoPago: 'TODOS',
    });
    expect(activos.filas).toHaveLength(4);

    const hombres = await obtenerPagosParaExportar({
      anio: 2026,
      socios: ['Activos', 'Hombres'],
      estadoPago: 'TODOS',
    });
    expect(hombres.filas).toHaveLength(3);

    const dosMilVeinticinco = await obtenerPagosParaExportar({
      anio: 2025,
      socios: [],
      estadoPago: 'TODOS',
    });
    expect(dosMilVeinticinco.filas).toHaveLength(1);
  });

  it('genera CSV con BOM, separador ; y protección de fórmulas', async () => {
    const exportacion = await obtenerPagosParaExportar({
      anio: 2026,
      socios: ['Activos', 'Hombres'],
      estadoPago: 'TODOS',
    });
    const csv = generarCsvPagos(exportacion);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"RUT"');
    expect(csv).toContain('"Fecha pago"');
    expect(csv.split('\r\n')).toHaveLength(4); // encabezado + 3 pagos

    const conFormula = {
      ...exportacion,
      filas: [{ ...exportacion.filas[0], observacion: '=1+1' }],
    };
    expect(generarCsvPagos(conFormula)).toContain(`"'=1+1"`);
  });

  it('genera XLSX con hojas Pagos y Filtros', async () => {
    const exportacion = await obtenerPagosParaExportar({
      anio: 2026,
      socios: [],
      estadoPago: 'TODOS',
    });
    const buffer = generarXlsxPagos(exportacion);
    const libro = XLSX.read(buffer, { type: 'buffer' });
    expect(libro.SheetNames).toEqual(['Pagos', 'Filtros']);

    const filas = XLSX.utils.sheet_to_json<string[]>(libro.Sheets.Pagos, { header: 1 });
    expect(filas).toHaveLength(6); // encabezado + 5 pagos
    expect(filas[0][4]).toBe('RUT');
  });
});
