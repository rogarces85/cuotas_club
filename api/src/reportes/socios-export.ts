import * as XLSX from 'xlsx';
import type { ExportacionPagos, FilaPagoExport } from './socios-service.js';

/**
 * Generación de archivos del reporte de pagos.
 *
 * CSV: delimitado por `;` y con BOM UTF-8 para que Excel en español lo abra
 * con las columnas separadas. Se neutralizan celdas que empiezan con
 * `= + - @` para evitar inyección de fórmulas al abrirlo en Excel.
 *
 * XLSX: una hoja de datos con autofiltro y una hoja con los filtros aplicados
 * y el total, para que el archivo se explique solo.
 */

const COLUMNAS: { clave: keyof FilaPagoExport | 'activoTexto' | 'sexoTexto'; titulo: string; ancho: number }[] = [
  { clave: 'id', titulo: 'ID', ancho: 8 },
  { clave: 'codigoPago', titulo: 'Código', ancho: 14 },
  { clave: 'fechaPago', titulo: 'Fecha pago', ancho: 13 },
  { clave: 'anioCuota', titulo: 'Año cuota', ancho: 10 },
  { clave: 'rut', titulo: 'RUT', ancho: 14 },
  { clave: 'nombreSnapshot', titulo: 'Nombre en el pago', ancho: 32 },
  { clave: 'nombreActual', titulo: 'Nombre actual', ancho: 32 },
  { clave: 'sexoTexto', titulo: 'Sexo', ancho: 12 },
  { clave: 'estadoSocio', titulo: 'Estado socio', ancho: 13 },
  { clave: 'activoTexto', titulo: 'Activo', ancho: 8 },
  { clave: 'tipoCuota', titulo: 'Tipo cuota', ancho: 12 },
  { clave: 'valorCuota', titulo: 'Valor cuota', ancho: 13 },
  { clave: 'mesesCantidad', titulo: 'Meses', ancho: 8 },
  { clave: 'mesesDetalle', titulo: 'Detalle meses', ancho: 24 },
  { clave: 'totalPago', titulo: 'Total pagado', ancho: 14 },
  { clave: 'estadoPago', titulo: 'Estado pago', ancho: 12 },
  { clave: 'origen', titulo: 'Origen', ancho: 11 },
  { clave: 'observacion', titulo: 'Observación', ancho: 30 },
];

const SEXO_LABEL: Record<string, string> = {
  HOMBRE: 'Hombre',
  MUJER: 'Mujer',
  INDEFINIDO: 'Indefinido',
};

function fechaCorta(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split('-');
  return dia && mes && anio ? `${dia}-${mes}-${anio}` : iso;
}

function valorCelda(fila: FilaPagoExport, clave: (typeof COLUMNAS)[number]['clave']): string | number {
  if (clave === 'sexoTexto') return fila.sexo ? SEXO_LABEL[fila.sexo] ?? fila.sexo : 'Sin dato';
  if (clave === 'activoTexto') return fila.activoSocio === 1 ? 'Sí' : 'No';
  if (clave === 'fechaPago') return fechaCorta(fila.fechaPago);
  if (clave === 'valorCuota' || clave === 'totalPago') return Number(fila[clave]);
  return fila[clave] ?? '';
}

/**
 * Neutraliza fórmulas de Excel y escapa comillas. El prefijo `'` hace que
 * Excel trate la celda como texto y no ejecute `=HYPERLINK(...)`.
 */
function celdaCsv(valor: string | number): string {
  const texto = String(valor ?? '');
  const seguro = /^[=+\-@]/.test(texto) ? `'${texto}` : texto;
  return `"${seguro.replace(/"/g, '""')}"`;
}

export function generarCsvPagos(exportacion: ExportacionPagos): string {
  const encabezados = COLUMNAS.map((columna) => celdaCsv(columna.titulo));
  const filas = exportacion.filas.map((fila) =>
    COLUMNAS.map((columna) => celdaCsv(valorCelda(fila, columna.clave))),
  );

  const contenido = [encabezados, ...filas].map((fila) => fila.join(';')).join('\r\n');
  return `\uFEFF${contenido}`;
}

export function generarXlsxPagos(exportacion: ExportacionPagos): Buffer {
  const libro = XLSX.utils.book_new();

  const encabezados = COLUMNAS.map((columna) => columna.titulo);
  const filas = exportacion.filas.map((fila) =>
    COLUMNAS.map((columna) => valorCelda(fila, columna.clave)),
  );

  const hojaPagos = XLSX.utils.aoa_to_sheet([encabezados, ...filas]);
  hojaPagos['!cols'] = COLUMNAS.map((columna) => ({ wch: columna.ancho }));
  hojaPagos['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: exportacion.filas.length, c: COLUMNAS.length - 1 },
    }),
  };
  XLSX.utils.book_append_sheet(libro, hojaPagos, 'Pagos');

  const resumen = [
    ['REPORTE DE PAGOS'],
    ['Año de pago', exportacion.anio],
    ['Filtros de socios', exportacion.filtros.socios.length > 0 ? exportacion.filtros.socios.join(', ') : 'Todos'],
    ['Estado de pago', exportacion.filtros.estadoPago],
    ['Filas exportadas', exportacion.resumen.totalFilas],
    ['Monto total', exportacion.resumen.montoTotal],
    ['Generado', new Date().toLocaleString('es-CL')],
    [],
    ['Nota', 'El año filtra la fecha de pago. El año de la cuota se muestra en su columna.'],
  ];
  const hojaResumen = XLSX.utils.aoa_to_sheet(resumen);
  hojaResumen['!cols'] = [{ wch: 20 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(libro, hojaResumen, 'Filtros');

  const salida = XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.isBuffer(salida) ? salida : Buffer.from(salida as ArrayBuffer);
}

export function nombreArchivoPagos(exportacion: ExportacionPagos, extension: 'csv' | 'xlsx'): string {
  return `pagos-${exportacion.anio}.${extension}`;
}
