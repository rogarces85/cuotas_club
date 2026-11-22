import { and, desc, eq, gte, inArray, lt, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/client.js';
import { clubSchema } from '@cuotas-club/shared';
import type { ReporteSociosQuery } from '@cuotas-club/shared';

/**
 * Service Layer del Reporte de Socios.
 *
 * Separación:
 * - Este archivo resuelve período, filtros y consultas (Drizzle/MySQL).
 * - `routes.ts` solo valida la request y serializa la respuesta o el archivo.
 *
 * Decisiones de consulta:
 * - Los rangos de fecha son semiabiertos (`>= inicio`, `< fin`) para que MySQL
 *   pueda usar `pago_fecha_idx` sin funciones sobre la columna. `MONTH()` o
 *   `DATE_FORMAT()` en el WHERE anularían el índice.
 * - Los filtros de socios (`activo`, `estado`, `sexo`) se aplican antes del
 *   JOIN con pagos. La tabla `socio` es pequeña; si crece, conviene un índice
 *   compuesto `(activo, estado, sexo)`.
 * - Las métricas se agregan en SQL (COUNT/SUM/GROUP BY) y se completan en JS
 *   los meses sin datos, para que las gráficas no tengan huecos.
 */

const { socio, pago } = clubSchema;

export type PeriodoReporte = 'ANIO' | 'TRIMESTRE' | 'MES';
export type EstadoPagoFiltro = 'TODOS' | 'APROBADO' | 'PENDIENTE' | 'RECHAZADO';

export class ErrorReporte extends Error {
  status: number;
  detalles: string[];

  constructor(mensaje: string, status = 400, detalles: string[] = []) {
    super(mensaje);
    this.name = 'ErrorReporte';
    this.status = status;
    this.detalles = detalles;
  }
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const TRIMESTRES = ['Primer', 'Segundo', 'Tercer', 'Cuarto'];

const dosDigitos = (n: number) => String(n).padStart(2, '0');

/** Fecha local del servidor como AAAA-MM-DD. */
function fechaIso(valor: Date | string): string {
  if (typeof valor === 'string') return valor.slice(0, 10);
  return `${valor.getFullYear()}-${dosDigitos(valor.getMonth() + 1)}-${dosDigitos(valor.getDate())}`;
}

function etiquetaMes(clave: string): string {
  const [anio, mes] = clave.split('-').map(Number);
  return `${MESES_CORTOS[mes - 1] ?? clave} ${anio}`;
}

export type PeriodoResuelto = {
  clave: string;
  etiqueta: string;
  anio: number;
  periodo: PeriodoReporte;
  trimestre: number | null;
  mes: number | null;
  inicio: string;
  fin: string;
  meses: string[];
  inicioPago: Date;
  finPagoExclusivo: Date;
  inicioIngreso: string;
  finIngresoExclusivo: string;
};

/**
 * Convierte las etiquetas de la UI (`Año`, `Trimestre`, `Mes`) en un rango
 * calendario concreto. Los Date se construyen en hora local porque la columna
 * `pago.fecha_pago` es DATE y mysql2 la serializa con la fecha local.
 */
export function resolverPeriodo(
  filtros: Pick<ReporteSociosQuery, 'anio' | 'periodo' | 'trimestre' | 'mes'>,
  hoy: Date = new Date(),
): PeriodoResuelto {
  const anio = filtros.anio ?? hoy.getFullYear();
  if (!Number.isInteger(anio) || anio < 2020 || anio > 2100) {
    throw new ErrorReporte('El año debe estar entre 2020 y 2100');
  }

  const periodo: PeriodoReporte = filtros.periodo ?? 'ANIO';
  let trimestre: number | null = null;
  let mes: number | null = null;
  let inicioMes: number;
  let finMesExclusivo: number;

  if (periodo === 'TRIMESTRE') {
    trimestre =
      filtros.trimestre ?? (anio === hoy.getFullYear() ? Math.floor(hoy.getMonth() / 3) + 1 : 1);
    if (!Number.isInteger(trimestre) || trimestre < 1 || trimestre > 4) {
      throw new ErrorReporte('El trimestre debe estar entre 1 y 4');
    }
    inicioMes = (trimestre - 1) * 3;
    finMesExclusivo = inicioMes + 3;
  } else if (periodo === 'MES') {
    mes = filtros.mes ?? (anio === hoy.getFullYear() ? hoy.getMonth() + 1 : 1);
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      throw new ErrorReporte('El mes debe estar entre 1 y 12');
    }
    inicioMes = mes - 1;
    finMesExclusivo = inicioMes + 1;
  } else {
    inicioMes = 0;
    finMesExclusivo = 12;
  }

  // Fecha local: mysql2 formatea un Date local como AAAA-MM-DD en la zona del
  // servidor. Evitamos UTC para no correr un día en Chile (UTC-3/-4).
  const inicioPago = new Date(anio, inicioMes, 1);
  const finPagoExclusivo = new Date(anio, finMesExclusivo, 1);
  // Día 0 del mes siguiente = último día del período, a medianoche local.
  const finInclusive = new Date(anio, finMesExclusivo, 0);

  const meses: string[] = [];
  for (let m = inicioMes; m < finMesExclusivo; m++) {
    meses.push(`${anio}-${dosDigitos(m + 1)}`);
  }

  let clave: string;
  let etiqueta: string;
  if (periodo === 'TRIMESTRE') {
    clave = `${anio}-T${trimestre}`;
    etiqueta = `${TRIMESTRES[(trimestre ?? 1) - 1]} trimestre ${anio}`;
  } else if (periodo === 'MES') {
    clave = `${anio}-${dosDigitos(mes ?? 1)}`;
    etiqueta = `${MESES[(mes ?? 1) - 1]} ${anio}`;
  } else {
    clave = String(anio);
    etiqueta = `Año ${anio}`;
  }

  return {
    clave,
    etiqueta,
    anio,
    periodo,
    trimestre,
    mes,
    inicio: fechaIso(inicioPago),
    fin: fechaIso(finInclusive),
    meses,
    inicioPago,
    finPagoExclusivo,
    inicioIngreso: fechaIso(inicioPago),
    finIngresoExclusivo: fechaIso(finPagoExclusivo),
  };
}

// ---------------------------------------------------------------------------
// Filtros de socios
// ---------------------------------------------------------------------------

export type FiltrosSociosInterpretados = {
  activo: boolean | undefined;
  estados: string[];
  sexos: string[];
  etiquetas: string[];
};

const ALIAS_FILTRO: Record<string, string> = {
  ACTIVO: 'ACTIVOS',
  ACTIVOS: 'ACTIVOS',
  INACTIVO: 'INACTIVOS',
  INACTIVOS: 'INACTIVOS',
  MEMBRESIA: 'MEMBRESIA',
  MEMBRESIAS: 'MEMBRESIA',
  BECADO: 'BECADO',
  BECADA: 'BECADO',
  BECADOS: 'BECADO',
  HOMBRE: 'HOMBRE',
  HOMBRES: 'HOMBRE',
  MUJER: 'MUJER',
  MUJERES: 'MUJER',
  INDEFINIDO: 'INDEFINIDO',
  INDEFINIDA: 'INDEFINIDO',
  TODOS: 'TODOS',
  TODAS: 'TODOS',
};

const ETIQUETA_FILTRO: Record<string, string> = {
  ACTIVOS: 'Activos',
  INACTIVOS: 'Inactivos',
  MEMBRESIA: 'Membresía',
  BECADO: 'Becado',
  HOMBRE: 'Hombres',
  MUJER: 'Mujeres',
  INDEFINIDO: 'Indefinido',
};

function normalizarToken(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}

/**
 * Interpreta etiquetas del usuario (`Activos`, `Hombres`, …) y las convierte
 * en condiciones tipadas. `Activos` filtra el flag `activo`; `Membresía` y
 * `Becado` filtran el estado; `Hombres`/`Mujeres` filtran el sexo.
 */
export function interpretarFiltrosSocios(socios: string[]): FiltrosSociosInterpretados {
  const estados = new Set<string>();
  const sexos = new Set<string>();
  const etiquetas: string[] = [];
  let activo: boolean | undefined;
  let activoVisto = false;

  for (const crudo of socios) {
    if (!crudo) continue;
    const token = ALIAS_FILTRO[normalizarToken(crudo)];
    if (!token) {
      throw new ErrorReporte(
        `Filtro de socio desconocido: "${crudo}". Usa Activos, Inactivos, Membresía, Becado, Hombres, Mujeres o Indefinido.`,
      );
    }
    if (token === 'TODOS') continue;

    if (token === 'ACTIVOS' || token === 'INACTIVOS') {
      const valor = token === 'ACTIVOS';
      if (activoVisto && activo !== valor) {
        throw new ErrorReporte('No se puede filtrar por Activos e Inactivos a la vez');
      }
      activo = valor;
      activoVisto = true;
    } else if (token === 'MEMBRESIA' || token === 'BECADO') {
      estados.add(token);
    } else {
      sexos.add(token);
    }

    const etiqueta = ETIQUETA_FILTRO[token];
    if (etiqueta && !etiquetas.includes(etiqueta)) etiquetas.push(etiqueta);
  }

  return {
    activo,
    estados: [...estados],
    sexos: [...sexos],
    etiquetas,
  };
}

function whereSocios(filtros: FiltrosSociosInterpretados): SQL | undefined {
  const condiciones: SQL[] = [];
  if (filtros.activo !== undefined) {
    condiciones.push(eq(socio.activo, filtros.activo ? 1 : 0));
  }
  if (filtros.estados.length > 0) {
    condiciones.push(inArray(socio.estado, filtros.estados));
  }
  if (filtros.sexos.length > 0) {
    condiciones.push(inArray(socio.sexo, filtros.sexos));
  }
  return condiciones.length > 0 ? and(...condiciones) : undefined;
}

// ---------------------------------------------------------------------------
// Reporte principal
// ---------------------------------------------------------------------------

export type ReporteSocios = Awaited<ReturnType<typeof obtenerReporteSocios>>;

export async function obtenerReporteSocios(
  filtros: Pick<ReporteSociosQuery, 'anio' | 'periodo' | 'trimestre' | 'mes' | 'socios'>,
) {
  const periodo = resolverPeriodo(filtros);
  const filtrosSocios = interpretarFiltrosSocios(filtros.socios);
  const where = whereSocios(filtrosSocios);

  // 1) Resumen del padrón. Una sola pasada sobre `socio` con agregados; no
  // hay JOIN para evitar multiplicar filas.
  const [resumenSocio] = await db
    .select({
      total: sql<number>`count(*)`,
      activos: sql<number>`sum(case when ${socio.activo} = 1 then 1 else 0 end)`,
      inactivos: sql<number>`sum(case when ${socio.activo} = 0 then 1 else 0 end)`,
      conEmail: sql<number>`sum(case when ${socio.email} is not null and ${socio.email} <> '' then 1 else 0 end)`,
      conFechaNacimiento: sql<number>`sum(case when ${socio.fechaNacimiento} is not null then 1 else 0 end)`,
      conFechaIngreso: sql<number>`sum(case when ${socio.fechaIngreso} is not null then 1 else 0 end)`,
      edadPromedio: sql<number | null>`round(avg(case when ${socio.fechaNacimiento} is not null then timestampdiff(year, ${socio.fechaNacimiento}, curdate()) end), 1)`,
    })
    .from(socio)
    .where(where);

  const totalSocios = Number(resumenSocio?.total ?? 0);
  const conEmail = Number(resumenSocio?.conEmail ?? 0);
  const edadPromedio =
    resumenSocio?.edadPromedio === null || resumenSocio?.edadPromedio === undefined
      ? null
      : Number(resumenSocio.edadPromedio);

  // 2) Distribuciones para gráficas. GROUP BY sobre la columna directa.
  const porSexoQ = await db
    .select({ clave: socio.sexo, total: sql<number>`count(*)` })
    .from(socio)
    .where(where)
    .groupBy(socio.sexo);
  const mapaSexo = new Map(porSexoQ.map((f) => [f.clave ?? 'SIN_DATO', Number(f.total)]));
  const porSexo = [
    { clave: 'HOMBRE', etiqueta: 'Hombres', total: mapaSexo.get('HOMBRE') ?? 0 },
    { clave: 'MUJER', etiqueta: 'Mujeres', total: mapaSexo.get('MUJER') ?? 0 },
    { clave: 'INDEFINIDO', etiqueta: 'Indefinido', total: mapaSexo.get('INDEFINIDO') ?? 0 },
    { clave: 'SIN_DATO', etiqueta: 'Sin dato', total: mapaSexo.get('SIN_DATO') ?? 0 },
  ];

  const porEstadoQ = await db
    .select({ clave: socio.estado, total: sql<number>`count(*)` })
    .from(socio)
    .where(where)
    .groupBy(socio.estado);
  const mapaEstado = new Map(porEstadoQ.map((f) => [f.clave, Number(f.total)]));
  const porEstado = ['ACTIVO', 'MEMBRESIA', 'BECADO'].map((estado) => ({
    clave: estado,
    etiqueta: estado === 'MEMBRESIA' ? 'Membresía' : estado.charAt(0) + estado.slice(1).toLowerCase(),
    total: mapaEstado.get(estado) ?? 0,
  }));
  const otrosEstados = [...mapaEstado.entries()]
    .filter(([clave]) => !['ACTIVO', 'MEMBRESIA', 'BECADO'].includes(clave))
    .reduce((acc, [, total]) => acc + total, 0);
  if (otrosEstados > 0) {
    porEstado.push({ clave: 'OTRO', etiqueta: 'Otro', total: otrosEstados });
  }

  // 3) Rangos de edad. El CASE se calcula después de filtrar; no se usa en el
  // WHERE para no anular índices. `fecha_nacimiento` no está indexada, pero el
  // conjunto ya viene acotado por los filtros de socios.
  const rangoEdad = sql<string>`case
    when ${socio.fechaNacimiento} is null then 'SIN_DATO'
    when timestampdiff(year, ${socio.fechaNacimiento}, curdate()) < 18 then 'MENOR_18'
    when timestampdiff(year, ${socio.fechaNacimiento}, curdate()) < 30 then '18_29'
    when timestampdiff(year, ${socio.fechaNacimiento}, curdate()) < 45 then '30_44'
    when timestampdiff(year, ${socio.fechaNacimiento}, curdate()) < 60 then '45_59'
    else '60_MAS' end`;
  const porEdadQ = await db
    .select({ clave: rangoEdad, total: sql<number>`count(*)` })
    .from(socio)
    .where(where)
    .groupBy(rangoEdad);
  const mapaEdad = new Map(porEdadQ.map((f) => [f.clave, Number(f.total)]));
  const porRangoEdad = [
    { clave: 'MENOR_18', etiqueta: 'Menor de 18', total: mapaEdad.get('MENOR_18') ?? 0 },
    { clave: '18_29', etiqueta: '18 a 29', total: mapaEdad.get('18_29') ?? 0 },
    { clave: '30_44', etiqueta: '30 a 44', total: mapaEdad.get('30_44') ?? 0 },
    { clave: '45_59', etiqueta: '45 a 59', total: mapaEdad.get('45_59') ?? 0 },
    { clave: '60_MAS', etiqueta: '60 o más', total: mapaEdad.get('60_MAS') ?? 0 },
    { clave: 'SIN_DATO', etiqueta: 'Sin fecha', total: mapaEdad.get('SIN_DATO') ?? 0 },
  ];

  // 4) Altas por mes. `fecha_ingreso` está en modo string en el esquema, así
  // que se compara contra fechas AAAA-MM-DD (semántica de DATE en MySQL).
  const mesIngreso = sql<string>`date_format(${socio.fechaIngreso}, '%Y-%m')`;
  const nuevosQ = await db
    .select({ clave: mesIngreso, total: sql<number>`count(*)` })
    .from(socio)
    .where(
      and(
        where,
        gte(socio.fechaIngreso, periodo.inicioIngreso),
        lt(socio.fechaIngreso, periodo.finIngresoExclusivo),
      ),
    )
    .groupBy(mesIngreso);
  const mapaNuevos = new Map(nuevosQ.map((f) => [f.clave, Number(f.total)]));
  const nuevosPorMes = periodo.meses.map((mes) => ({
    clave: mes,
    etiqueta: etiquetaMes(mes),
    total: mapaNuevos.get(mes) ?? 0,
  }));

  // 5) Recaudación del período. Solo pagos APROBADOS; el rango semiabierto usa
  // `pago_fecha_idx`. El JOIN con `socio` aplica los filtros demográficos y usa
  // `pago_socio_idx` para resolver la relación.
  const wherePagos = and(
    eq(pago.estado, 'APROBADO'),
    gte(pago.fechaPago, periodo.inicioPago),
    lt(pago.fechaPago, periodo.finPagoExclusivo),
    where,
  );

  const [totalesPago] = await db
    .select({
      monto: sql<number>`coalesce(sum(${pago.totalPago}), 0)`,
      cantidad: sql<number>`count(*)`,
      pagadores: sql<number>`count(distinct ${pago.socioId})`,
    })
    .from(pago)
    .innerJoin(socio, eq(pago.socioId, socio.id))
    .where(wherePagos);

  const mesPago = sql<string>`date_format(${pago.fechaPago}, '%Y-%m')`;
  const pagosPorMesQ = await db
    .select({
      clave: mesPago,
      monto: sql<number>`coalesce(sum(${pago.totalPago}), 0)`,
      cantidad: sql<number>`count(*)`,
    })
    .from(pago)
    .innerJoin(socio, eq(pago.socioId, socio.id))
    .where(wherePagos)
    .groupBy(mesPago);
  const mapaPagos = new Map(pagosPorMesQ.map((f) => [f.clave, f]));
  const pagosPorMes = periodo.meses.map((mes) => ({
    clave: mes,
    etiqueta: etiquetaMes(mes),
    monto: Number(mapaPagos.get(mes)?.monto ?? 0),
    cantidad: Number(mapaPagos.get(mes)?.cantidad ?? 0),
  }));

  const porTipoCuotaQ = await db
    .select({
      clave: pago.tipoCuota,
      monto: sql<number>`coalesce(sum(${pago.totalPago}), 0)`,
      cantidad: sql<number>`count(*)`,
    })
    .from(pago)
    .innerJoin(socio, eq(pago.socioId, socio.id))
    .where(wherePagos)
    .groupBy(pago.tipoCuota);
  const etiquetasTipo: Record<string, string> = {
    ACTIVO: 'Activo',
    MEMBRESIA: 'Membresía',
    BECADO: 'Becado',
    OTRO: 'Otro',
  };
  const porTipoCuota = porTipoCuotaQ.map((f) => ({
    clave: f.clave,
    etiqueta: etiquetasTipo[f.clave] ?? f.clave,
    monto: Number(f.monto),
    cantidad: Number(f.cantidad),
  }));

  const recaudacion = Number(totalesPago?.monto ?? 0);
  const pagosAprobados = Number(totalesPago?.cantidad ?? 0);
  const sociosPagadores = Number(totalesPago?.pagadores ?? 0);

  return {
    generadoEn: new Date().toISOString(),
    periodo: {
      clave: periodo.clave,
      etiqueta: periodo.etiqueta,
      inicio: periodo.inicio,
      fin: periodo.fin,
      meses: periodo.meses,
    },
    filtros: {
      anio: periodo.anio,
      periodo: periodo.periodo,
      trimestre: periodo.trimestre,
      mes: periodo.mes,
      activo: filtrosSocios.activo ?? null,
      estados: filtrosSocios.estados,
      sexos: filtrosSocios.sexos,
      socios: filtrosSocios.etiquetas,
    },
    resumen: {
      totalSocios,
      activos: Number(resumenSocio?.activos ?? 0),
      inactivos: Number(resumenSocio?.inactivos ?? 0),
      conEmail,
      sinEmail: totalSocios - conEmail,
      conFechaNacimiento: Number(resumenSocio?.conFechaNacimiento ?? 0),
      conFechaIngreso: Number(resumenSocio?.conFechaIngreso ?? 0),
      edadPromedio,
      recaudacionPeriodo: recaudacion,
      pagosAprobados,
      sociosPagadores,
      promedioPorPago: pagosAprobados > 0 ? Math.round(recaudacion / pagosAprobados) : 0,
    },
    porSexo,
    porEstado,
    porRangoEdad,
    nuevosPorMes,
    pagos: {
      porMes: pagosPorMes,
      porTipoCuota,
    },
  };
}

// ---------------------------------------------------------------------------
// Exportación de pagos
// ---------------------------------------------------------------------------

export type FilaPagoExport = {
  id: number;
  codigoPago: string | null;
  fechaPago: string;
  anioCuota: number;
  rut: string;
  nombreSnapshot: string;
  nombreActual: string;
  sexo: string | null;
  estadoSocio: string;
  activoSocio: number;
  tipoCuota: string;
  valorCuota: number;
  mesesCantidad: number;
  mesesDetalle: string | null;
  totalPago: number;
  estadoPago: string;
  origen: string;
  observacion: string | null;
};

export type FiltrosExportPagos = {
  anio: number;
  socios: string[];
  estadoPago: EstadoPagoFiltro;
};

export type ExportacionPagos = {
  anio: number;
  filtros: {
    socios: string[];
    estadoPago: EstadoPagoFiltro;
  };
  resumen: {
    totalFilas: number;
    montoTotal: number;
    limite: number;
  };
  filas: FilaPagoExport[];
};

/**
 * Filas para el archivo de pagos.
 *
 * El filtro "Año" se aplica sobre `fecha_pago` (el año en que se pagó), no
 * sobre `pago.anio` (año de la cuota). Así se aprovecha `pago_fecha_idx` con un
 * rango semiabierto y el resultado coincide con lo que la tesorería espera de
 * "pagos del año". El año de la cuota se exporta como columna aparte.
 */
export async function obtenerPagosParaExportar(
  filtros: FiltrosExportPagos,
  hoy: Date = new Date(),
): Promise<ExportacionPagos> {
  const anio = filtros.anio ?? hoy.getFullYear();
  if (!Number.isInteger(anio) || anio < 2020 || anio > 2100) {
    throw new ErrorReporte('El año debe estar entre 2020 y 2100');
  }

  const filtrosSocios = interpretarFiltrosSocios(filtros.socios);
  const where = whereSocios(filtrosSocios);

  const inicio = new Date(anio, 0, 1);
  const finExclusivo = new Date(anio + 1, 0, 1);

  const condiciones: SQL[] = [
    gte(pago.fechaPago, inicio),
    lt(pago.fechaPago, finExclusivo),
  ];
  if (filtros.estadoPago !== 'TODOS') {
    condiciones.push(eq(pago.estado, filtros.estadoPago));
  }

  const filasCrudas = await db
    .select({
      id: pago.id,
      codigoPago: pago.codigoPago,
      fechaPago: pago.fechaPago,
      anioCuota: pago.anio,
      rut: pago.rut,
      nombreSnapshot: pago.nombreSnapshot,
      nombreActual: socio.nombre,
      sexo: socio.sexo,
      estadoSocio: socio.estado,
      activoSocio: socio.activo,
      tipoCuota: pago.tipoCuota,
      valorCuota: pago.valorCuota,
      mesesCantidad: pago.mesesCantidad,
      mesesDetalle: pago.mesesDetalle,
      totalPago: pago.totalPago,
      estadoPago: pago.estado,
      origen: pago.origen,
      observacion: pago.observacion,
    })
    .from(pago)
    .innerJoin(socio, eq(pago.socioId, socio.id))
    .where(and(...condiciones, where))
    .orderBy(desc(pago.fechaPago), desc(pago.id))
    // Límite defensivo: el club tiene decenas de socios; si algún día crece,
    // conviene paginar o transmitir el archivo por streaming.
    .limit(10000);

  const filas: FilaPagoExport[] = filasCrudas.map((fila) => ({
    ...fila,
    fechaPago: fechaIso(fila.fechaPago),
    totalPago: Number(fila.totalPago),
    valorCuota: Number(fila.valorCuota),
    anioCuota: Number(fila.anioCuota),
    mesesCantidad: Number(fila.mesesCantidad),
    activoSocio: Number(fila.activoSocio),
  }));

  return {
    anio,
    filtros: {
      socios: filtrosSocios.etiquetas,
      estadoPago: filtros.estadoPago,
    },
    resumen: {
      totalFilas: filas.length,
      montoTotal: filas.reduce((acc, fila) => acc + fila.totalPago, 0),
      limite: 10000,
    },
    filas,
  };
}
