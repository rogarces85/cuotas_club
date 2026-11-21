import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, gte, lte, sql, desc, count, sum, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { clubSchema } from '@cuotas-club/shared';
import { panelKpisQuerySchema } from '@cuotas-club/shared';
import { requireSession } from '../middleware/auth.js';

const {
  socio,
  pago,
  pagoMes,
  periodoCuota,
  comprobante,
  egreso,
  otroIngreso,
  gastoFijo,
  categoriaEgreso,
  configClub,
} = clubSchema;

const nowSec = () => Math.floor(Date.now() / 1000);

/**
 * Rutas del Panel/Dashboard (M5).
 *
 * GET /api/panel/kpis — 4 KPIs principales
 * GET /api/panel/recaudacion — serie temporal últimos 6 meses
 * GET /api/panel/ultimos-pagos — últimos 5 pagos aprobados
 * GET /api/panel/meta — meta del mes (desde config)
 */

export const panel = new Hono();

panel.use('*', requireSession);

// Helper: obtener mes actual o del query
function obtenerMes(query: { mes?: string }) {
  if (query.mes) {
    const [anio, mes] = query.mes.split('-').map(Number);
    return { anio, mes };
  }
  const ahora = new Date();
  return { anio: ahora.getFullYear(), mes: ahora.getMonth() + 1 };
}

// Helper: rango de fechas del mes
function rangoMes(anio: number, mes: number) {
  const inicio = new Date(anio, mes - 1, 1);
  const fin = new Date(anio, mes, 0, 23, 59, 59);
  return { inicio, fin };
}

// Helper: obtener valor de config
async function obtenerConfig(clave: string): Promise<string | null> {
  const [cfg] = await db
    .select({ valor: configClub.valor })
    .from(configClub)
    .where(eq(configClub.clave, clave))
    .limit(1);
  return cfg?.valor ?? null;
}

// ==================== KPIs ====================

panel.get('/kpis', zValidator('query', panelKpisQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const { anio, mes } = obtenerMes(query);
  const { inicio, fin } = rangoMes(anio, mes);

  // 1. Recaudado del mes (pagos aprobados en el mes)
  const [{ total: recaudadoMes }] = await db
    .select({ total: sql<number>`coalesce(sum(${pago.totalPago}), 0)` })
    .from(pago)
    .where(and(eq(pago.estado, 'APROBADO'), gte(pago.fechaPago, inicio), lte(pago.fechaPago, fin)));

  // 2. Socios morosos (activos con al menos un período sin pago aprobado)
  // Subquery: períodos existentes
  const periodosSub = db
    .select({ periodo: periodoCuota.periodo })
    .from(periodoCuota);

  // Subquery: pagos aprobados por socio y período
  const pagosAprobadosSub = db
    .select({
      socioId: pagoMes.socioId,
      periodo: pagoMes.periodo,
    })
    .from(pagoMes)
    .innerJoin(pago, eq(pagoMes.pagoId, pago.id))
    .where(eq(pago.estado, 'APROBADO'));

  // Socios activos con deuda = períodos totales - períodos pagados
  const sociosActivos = await db
    .select({ id: socio.id })
    .from(socio)
    .where(eq(socio.activo, 1));

  let morosos = 0;
  for (const s of sociosActivos) {
    const [periodosTotales] = await db
      .select({ count: sql<number>`count(*)` })
      .from(periodoCuota);

    const [periodosPagados] = await db
      .select({ count: sql<number>`count(*)` })
      .from(pagoMes)
      .innerJoin(pago, eq(pagoMes.pagoId, pago.id))
      .where(and(eq(pagoMes.socioId, s.id), eq(pago.estado, 'APROBADO')));

    if (Number(periodosTotales.count) > Number(periodosPagados.count)) {
      morosos++;
    }
  }

  // 3. Socios activos
  const [{ total: sociosActivosTotal }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(socio)
    .where(eq(socio.activo, 1));

  // 4. Comprobantes por revisar (estado PENDIENTE)
  const [{ total: comprobantesPendientes }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(comprobante)
    .where(eq(comprobante.estado, 'PENDIENTE'));

  return c.json({
    mes: `${anio}-${String(mes).padStart(2, '0')}`,
    recaudadoMes: Number(recaudadoMes),
    sociosMorosos: morosos,
    sociosActivos: Number(sociosActivosTotal),
    comprobantesPendientes: Number(comprobantesPendientes),
  });
});

// ==================== SERIE RECAUDACIÓN (últimos 6 meses) ====================

panel.get('/recaudacion', async (c) => {
  const { anio, mes } = obtenerMes(c.req.query());

  const serie = [];

  for (let i = 5; i >= 0; i--) {
    let m = mes - i;
    let a = anio;
    if (m <= 0) {
      m += 12;
      a -= 1;
    }
    const { inicio, fin } = rangoMes(a, m);

    const [{ total }] = await db
      .select({ total: sql<number>`coalesce(sum(${pago.totalPago}), 0)` })
      .from(pago)
      .where(and(eq(pago.estado, 'APROBADO'), gte(pago.fechaPago, inicio), lte(pago.fechaPago, fin)));

    serie.push({
      periodo: `${a}-${String(m).padStart(2, '0')}`,
      monto: Number(total),
    });
  }

  return c.json({ serie });
});

// ==================== ÚLTIMOS PAGOS ====================

panel.get('/ultimos-pagos', async (c) => {
  const limite = 5;

  const pagos = await db
    .select({
      id: pago.id,
      fechaPago: pago.fechaPago,
      totalPago: pago.totalPago,
      rut: pago.rut,
      nombreSnapshot: pago.nombreSnapshot,
      tipoCuota: pago.tipoCuota,
    })
    .from(pago)
    .where(eq(pago.estado, 'APROBADO'))
    .orderBy(desc(pago.fechaPago), desc(pago.createdAt))
    .limit(limite);

  return c.json({ pagos });
});

// ==================== META DEL MES ====================

panel.get('/meta', async (c) => {
  const { anio, mes } = obtenerMes(c.req.query());

  // Obtener meta de config
  const metaStr = await obtenerConfig('meta_mensual');
  const meta = metaStr ? parseInt(metaStr, 10) : 0;

  const { inicio, fin } = rangoMes(anio, mes);

  const [{ total: recaudado }] = await db
    .select({ total: sql<number>`coalesce(sum(${pago.totalPago}), 0)` })
    .from(pago)
    .where(and(eq(pago.estado, 'APROBADO'), gte(pago.fechaPago, inicio), lte(pago.fechaPago, fin)));

  const porcentaje = meta > 0 ? Math.round((Number(recaudado) / meta) * 100) : 0;

  return c.json({
    mes: `${anio}-${String(mes).padStart(2, '0')}`,
    meta,
    recaudado: Number(recaudado),
    porcentaje,
    faltante: meta > Number(recaudado) ? meta - Number(recaudado) : 0,
  });
});

// ==================== RESUMEN FINANCIERO RÁPIDO ====================

panel.get('/resumen', async (c) => {
  const { anio, mes } = obtenerMes(c.req.query());
  const { inicio, fin } = rangoMes(anio, mes);

  // Ingresos mes (pagos aprobados)
  const [{ total: ingresosMes }] = await db
    .select({ total: sql<number>`coalesce(sum(${pago.totalPago}), 0)` })
    .from(pago)
    .where(and(eq(pago.estado, 'APROBADO'), gte(pago.fechaPago, inicio), lte(pago.fechaPago, fin)));

  // Egresos mes
  const [{ total: egresosMes }] = await db
    .select({ total: sql<number>`coalesce(sum(${egreso.monto}), 0)` })
    .from(egreso)
    .where(and(gte(egreso.fecha, inicio), lte(egreso.fecha, fin)));

  // Otros ingresos mes
  const [{ total: otrosIngresosMes }] = await db
    .select({ total: sql<number>`coalesce(sum(${otroIngreso.monto}), 0)` })
    .from(otroIngreso)
    .where(and(gte(otroIngreso.fecha, inicio), lte(otroIngreso.fecha, fin)));

  // Gastos fijos mensuales
  const gastosFijos = await db
    .select({ monto: gastoFijo.monto, periodicidad: gastoFijo.periodicidad })
    .from(gastoFijo)
    .where(eq(gastoFijo.activo, 1));

  let gastosFijosMensuales = 0;
  for (const gf of gastosFijos) {
    let mensual = Number(gf.monto);
    switch (gf.periodicidad) {
      case 'trimestral': mensual /= 3; break;
      case 'semestral': mensual /= 6; break;
      case 'anual': mensual /= 12; break;
    }
    gastosFijosMensuales += mensual;
  }

  const totalEgresos = Number(egresosMes) + gastosFijosMensuales;
  const saldo = Number(ingresosMes) + Number(otrosIngresosMes) - totalEgresos;

  return c.json({
    mes: `${anio}-${String(mes).padStart(2, '0')}`,
    ingresos: {
      pagos: Number(ingresosMes),
      otros: Number(otrosIngresosMes),
      total: Number(ingresosMes) + Number(otrosIngresosMes),
    },
    egresos: {
      variables: Number(egresosMes),
      fijos: gastosFijosMensuales,
      total: totalEgresos,
    },
    saldo,
  });
});