import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, gte, lte, sql, desc, sum, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { clubSchema } from '@cuotas-club/shared';
import { reporteBalanceQuerySchema, panelKpisQuerySchema } from '@cuotas-club/shared';
import { requireSession } from '../middleware/auth.js';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'node:stream';

const {
  pago,
  pagoMes,
  egreso,
  otroIngreso,
  gastoFijo,
  socio,
  periodoCuota,
  categoriaEgreso,
} = clubSchema;

/**
 * Rutas de reportes (M5).
 *
 * GET /api/reportes/balance — balance del período (ingresos, egresos, otros ingresos, saldo)
 *   Query: periodo (AAAA-MM) O desde/hasta (AAAA-MM-DD), formato (json|xlsx|pdf)
 *
 * GET /api/reportes/detalle-pagos — detalle de pagos en el período
 * GET /api/reportes/detalle-egresos — detalle de egresos en el período
 */

export const reportes = new Hono();

reportes.use('*', requireSession);

// Helper: obtener rango de fechas desde query
function obtenerRangoFechas(query: { periodo?: string; desde?: string; hasta?: string }) {
  if (query.periodo) {
    // periodo AAAA-MM -> primer y último día del mes
    const [anio, mes] = query.periodo.split('-').map(Number);
    const inicio = new Date(anio, mes - 1, 1);
    const fin = new Date(anio, mes, 0, 23, 59, 59); // último día del mes
    return { inicio, fin };
  }
  if (query.desde && query.hasta) {
    const inicio = new Date(query.desde + 'T00:00:00');
    const fin = new Date(query.hasta + 'T23:59:59');
    return { inicio, fin };
  }
  // Default: mes actual
  const ahora = new Date();
  const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59);
  return { inicio, fin };
}

// Helper: formatear fecha para output
function formatearFecha(date: Date | string | null): string {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date + 'T00:00:00');
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

function formatearClp(n: number): string {
  return `$${n.toLocaleString('es-CL')}`;
}

// ==================== BALANCE ====================

reportes.get('/balance', zValidator('query', reporteBalanceQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const formato = query.formato ?? 'json';
  const { inicio, fin } = obtenerRangoFechas(query);

  // 1. Ingresos por pagos aprobados en el período
  const pagosAprobados = await db
    .select({
      id: pago.id,
      fechaPago: pago.fechaPago,
      totalPago: pago.totalPago,
      rut: pago.rut,
      nombreSnapshot: pago.nombreSnapshot,
      tipoCuota: pago.tipoCuota,
      mesesDetalle: pago.mesesDetalle,
    })
    .from(pago)
    .where(
      and(
        eq(pago.estado, 'APROBADO'),
        gte(pago.fechaPago, inicio),
        lte(pago.fechaPago, fin),
      ),
    )
    .orderBy(desc(pago.fechaPago));

  const totalIngresos = pagosAprobados.reduce((acc, p) => acc + Number(p.totalPago), 0);

  // 2. Egresos en el período
  const egresosPeriodo = await db
    .select({
      id: egreso.id,
      fecha: egreso.fecha,
      monto: egreso.monto,
      descripcion: egreso.descripcion,
      boletaRuta: egreso.boletaRuta,
      categoriaNombre: categoriaEgreso.nombre,
    })
    .from(egreso)
    .leftJoin(categoriaEgreso, eq(egreso.categoriaId, categoriaEgreso.id))
    .where(and(gte(egreso.fecha, inicio), lte(egreso.fecha, fin)))
    .orderBy(desc(egreso.fecha));

  const totalEgresos = egresosPeriodo.reduce((acc, e) => acc + Number(e.monto), 0);

  // 3. Otros ingresos en el período
  const otrosIngresosPeriodo = await db
    .select()
    .from(otroIngreso)
    .where(and(gte(otroIngreso.fecha, inicio), lte(otroIngreso.fecha, fin)))
    .orderBy(desc(otroIngreso.fecha));

  const totalOtrosIngresos = otrosIngresosPeriodo.reduce((acc, o) => acc + Number(o.monto), 0);

  // 4. Gastos fijos que caen en el período (aproximación: si el período incluye el mes, contamos el monto mensual)
  // Para simplificar, sumamos todos los gastos fijos activos (se puede refinar luego)
  const gastosFijosActivos = await db
    .select()
    .from(gastoFijo)
    .where(eq(gastoFijo.activo, 1));

  // Convertir a monto mensual según periodicidad
  let totalGastosFijosMensual = 0;
  for (const gf of gastosFijosActivos) {
    let mensual = Number(gf.monto);
    switch (gf.periodicidad) {
      case 'trimestral': mensual /= 3; break;
      case 'semestral': mensual /= 6; break;
      case 'anual': mensual /= 12; break;
    }
    totalGastosFijosMensual += mensual;
  }

  const totalEgresosConFijos = totalEgresos + totalGastosFijosMensual;
  const saldo = totalIngresos + totalOtrosIngresos - totalEgresosConFijos;

  const resumen = {
    periodo: query.periodo ?? `${formatearFecha(inicio)} - ${formatearFecha(fin)}`,
    inicio: formatearFecha(inicio),
    fin: formatearFecha(fin),
    ingresos: {
      pagosAprobados: totalIngresos,
      otrosIngresos: totalOtrosIngresos,
      total: totalIngresos + totalOtrosIngresos,
    },
    egresos: {
      variables: totalEgresos,
      fijosMensuales: totalGastosFijosMensual,
      total: totalEgresosConFijos,
    },
    saldo,
    detalle: {
      pagos: pagosAprobados.map(p => ({
        id: p.id,
        fecha: formatearFecha(p.fechaPago),
        monto: Number(p.totalPago),
        rut: p.rut,
        nombre: p.nombreSnapshot,
        tipo: p.tipoCuota,
        meses: p.mesesDetalle,
      })),
      egresos: egresosPeriodo.map(e => ({
        id: e.id,
        fecha: formatearFecha(e.fecha),
        monto: Number(e.monto),
        descripcion: e.descripcion,
        categoria: e.categoriaNombre ?? 'Sin categoría',
        tieneBoleta: !!e.boletaRuta,
      })),
      otrosIngresos: otrosIngresosPeriodo.map(o => ({
        id: o.id,
        fecha: formatearFecha(o.fecha),
        monto: Number(o.monto),
        descripcion: o.descripcion,
        origen: o.origen,
      })),
      gastosFijos: gastosFijosActivos.map(gf => ({
        id: gf.id,
        descripcion: gf.descripcion,
        montoOriginal: Number(gf.monto),
        montoMensual: Number(gf.monto) / (gf.periodicidad === 'mensual' ? 1 : gf.periodicidad === 'trimestral' ? 3 : gf.periodicidad === 'semestral' ? 6 : 12),
        periodicidad: gf.periodicidad,
      })),
    },
  };

  // Exportar según formato
  if (formato === 'xlsx') {
    return exportarXLSX(resumen);
  }
  if (formato === 'pdf') {
    return exportarPDF(resumen);
  }

  return c.json(resumen);
});

// ==================== EXPORT XLSX ====================

function exportarXLSX(data: any) {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Resumen
  const resumenRows = [
    ['REPORTE DE BALANCE', ''],
    ['Período', data.periodo],
    ['Desde', data.inicio],
    ['Hasta', data.fin],
    [''],
    ['INGRESOS', ''],
    ['Pagos aprobados', formatearClp(data.ingresos.pagosAprobados)],
    ['Otros ingresos', formatearClp(data.ingresos.otrosIngresos)],
    ['TOTAL INGRESOS', formatearClp(data.ingresos.total)],
    [''],
    ['EGRESOS', ''],
    ['Egresos variables', formatearClp(data.egresos.variables)],
    ['Gastos fijos (mensual)', formatearClp(data.egresos.fijosMensuales)],
    ['TOTAL EGRESOS', formatearClp(data.egresos.total)],
    [''],
    ['SALDO', formatearClp(data.saldo)],
  ];
  const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows);
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

  // Hoja 2: Detalle pagos
  const pagosRows = [
    ['ID', 'Fecha', 'Monto', 'RUT', 'Nombre', 'Tipo', 'Meses'],
    ...data.detalle.pagos.map((p: any) => [p.id, p.fecha, formatearClp(p.monto), p.rut, p.nombre, p.tipo, p.meses]),
  ];
  const wsPagos = XLSX.utils.aoa_to_sheet(pagosRows);
  XLSX.utils.book_append_sheet(wb, wsPagos, 'Pagos');

  // Hoja 3: Detalle egresos
  const egresosRows = [
    ['ID', 'Fecha', 'Monto', 'Descripción', 'Categoría', 'Boleta'],
    ...data.detalle.egresos.map((e: any) => [e.id, e.fecha, formatearClp(e.monto), e.descripcion, e.categoria, e.tieneBoleta ? 'Sí' : 'No']),
  ];
  const wsEgresos = XLSX.utils.aoa_to_sheet(egresosRows);
  XLSX.utils.book_append_sheet(wb, wsEgresos, 'Egresos');

  // Hoja 4: Otros ingresos
  const otrosRows = [
    ['ID', 'Fecha', 'Monto', 'Descripción', 'Origen'],
    ...data.detalle.otrosIngresos.map((o: any) => [o.id, o.fecha, formatearClp(o.monto), o.descripcion, o.origen ?? '']),
  ];
  const wsOtros = XLSX.utils.aoa_to_sheet(otrosRows);
  XLSX.utils.book_append_sheet(wb, wsOtros, 'Otros Ingresos');

  // Hoja 5: Gastos fijos
  const fijosRows = [
    ['ID', 'Descripción', 'Monto original', 'Monto mensual', 'Periodicidad'],
    ...data.detalle.gastosFijos.map((gf: any) => [gf.id, gf.descripcion, formatearClp(gf.montoOriginal), formatearClp(gf.montoMensual), gf.periodicidad]),
  ];
  const wsFijos = XLSX.utils.aoa_to_sheet(fijosRows);
  XLSX.utils.book_append_sheet(wb, wsFijos, 'Gastos Fijos');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="balance-${data.periodo.replace('/', '-')}.xlsx"`,
    },
  });
}

// ==================== EXPORT PDF ====================

function exportarPDF(data: any) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const stream = new PassThrough();
  const chunks: Buffer[] = [];

  stream.on('data', (chunk) => chunks.push(chunk));
  stream.on('end', () => {});

  doc.pipe(stream);

  // Título
  doc.fontSize(20).text('Reporte de Balance', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Período: ${data.periodo}`, { align: 'center' });
  doc.text(`Desde: ${data.inicio}  Hasta: ${data.fin}`, { align: 'center' });
  doc.moveDown(1);

  // Ingresos
  doc.fontSize(14).text('INGRESOS', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11);
  doc.text(`Pagos aprobados: ${formatearClp(data.ingresos.pagosAprobados)}`);
  doc.text(`Otros ingresos: ${formatearClp(data.ingresos.otrosIngresos)}`);
  doc.font('Helvetica-Bold').fontSize(12).text(`TOTAL INGRESOS: ${formatearClp(data.ingresos.total)}`);
  doc.font('Helvetica');
  doc.moveDown(1);

  // Egresos
  doc.fontSize(14).text('EGRESOS', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11);
  doc.text(`Egresos variables: ${formatearClp(data.egresos.variables)}`);
  doc.text(`Gastos fijos (mensual): ${formatearClp(data.egresos.fijosMensuales)}`);
  doc.font('Helvetica-Bold').fontSize(12).text(`TOTAL EGRESOS: ${formatearClp(data.egresos.total)}`);
  doc.font('Helvetica');
  doc.moveDown(1);

  // Saldo
  doc.font('Helvetica-Bold').fontSize(14).text(`SALDO: ${formatearClp(data.saldo)}`, { align: 'right' });
  doc.font('Helvetica');
  doc.moveDown(1.5);

  // Detalle pagos (tabla simple)
  if (data.detalle.pagos.length > 0) {
    doc.fontSize(14).text('DETALLE DE PAGOS', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9);
    const headers = ['Fecha', 'Monto', 'RUT', 'Nombre', 'Tipo'];
    const colWidths = [60, 70, 70, 150, 80];
    let x = doc.page.margins.left;

    // Header
    doc.font('Helvetica-Bold');
    headers.forEach((h, i) => {
      doc.text(h, x, doc.y, { width: colWidths[i], align: i === 1 ? 'right' : 'left' });
      x += colWidths[i] + 5;
    });
    doc.moveDown(0.3);
    doc.font('Helvetica');

    for (const p of data.detalle.pagos.slice(0, 30)) {
      x = doc.page.margins.left;
      const vals = [p.fecha, formatearClp(p.monto), p.rut, p.nombre.substring(0, 25), p.tipo];
      vals.forEach((v, i) => {
        doc.text(String(v), x, doc.y, { width: colWidths[i], align: i === 1 ? 'right' : 'left' });
        x += colWidths[i] + 5;
      });
      doc.moveDown(0.2);
      if (doc.y > doc.page.height - 80) {
        doc.addPage();
        doc.fontSize(9);
      }
    }
    doc.moveDown(1);
  }

  // Detalle egresos
  if (data.detalle.egresos.length > 0) {
    doc.fontSize(14).text('DETALLE DE EGRESOS', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9);
    const headers = ['Fecha', 'Monto', 'Descripción', 'Categoría'];
    const colWidths = [60, 70, 200, 100];
    let x = doc.page.margins.left;

    doc.font('Helvetica-Bold');
    headers.forEach((h, i) => {
      doc.text(h, x, doc.y, { width: colWidths[i], align: i === 1 ? 'right' : 'left' });
      x += colWidths[i] + 5;
    });
    doc.moveDown(0.3);
    doc.font('Helvetica');

    for (const e of data.detalle.egresos.slice(0, 30)) {
      x = doc.page.margins.left;
      const vals = [e.fecha, formatearClp(e.monto), e.descripcion.substring(0, 40), e.categoria];
      vals.forEach((v, i) => {
        doc.text(String(v), x, doc.y, { width: colWidths[i], align: i === 1 ? 'right' : 'left' });
        x += colWidths[i] + 5;
      });
      doc.moveDown(0.2);
      if (doc.y > doc.page.height - 80) {
        doc.addPage();
        doc.fontSize(9);
      }
    }
  }

  doc.end();

  return new Response(stream as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="balance-${data.periodo.replace('/', '-')}.pdf"`,
    },
  });
}

// ==================== DETALLE PAGOS ====================

reportes.get('/detalle-pagos', zValidator('query', reporteBalanceQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const { inicio, fin } = obtenerRangoFechas(query);

  const pagos = await db
    .select({
      id: pago.id,
      fechaPago: pago.fechaPago,
      totalPago: pago.totalPago,
      rut: pago.rut,
      nombreSnapshot: pago.nombreSnapshot,
      tipoCuota: pago.tipoCuota,
      mesesDetalle: pago.mesesDetalle,
    })
    .from(pago)
    .where(and(eq(pago.estado, 'APROBADO'), gte(pago.fechaPago, inicio), lte(pago.fechaPago, fin)))
    .orderBy(desc(pago.fechaPago));

  return c.json({ pagos });
});

// ==================== DETALLE EGRESOS ====================

reportes.get('/detalle-egresos', zValidator('query', reporteBalanceQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const { inicio, fin } = obtenerRangoFechas(query);

  const egresos = await db
    .select({
      id: egreso.id,
      fecha: egreso.fecha,
      monto: egreso.monto,
      descripcion: egreso.descripcion,
      boletaRuta: egreso.boletaRuta,
      categoriaNombre: categoriaEgreso.nombre,
    })
    .from(egreso)
    .leftJoin(categoriaEgreso, eq(egreso.categoriaId, categoriaEgreso.id))
    .where(and(gte(egreso.fecha, inicio), lte(egreso.fecha, fin)))
    .orderBy(desc(egreso.fecha));

  return c.json({ egresos });
});