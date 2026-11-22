/**
 * Cálculos de cumpleaños y antigüedad en el club.
 *
 * Todo se resuelve con fechas calendario locales: el club vive en Chile y
 * una diferencia de un día cambia el saludo. No se usan timestamps UTC para
 * decidir si hoy es el cumpleaños.
 */

export const MESES_ES = [
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
] as const;

export const MESES_CORTOS_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

export type PeriodoCumpleanos = {
  anio: number;
  mes: number;
  clave: string; // AAAA-MM
  etiqueta: string; // noviembre 2026
  mesCorto: string; // nov
};

function dosDigitos(n: number): string {
  return String(n).padStart(2, '0');
}

function construirPeriodo(anio: number, mes: number): PeriodoCumpleanos {
  return {
    anio,
    mes,
    clave: `${anio}-${dosDigitos(mes)}`,
    etiqueta: `${MESES_ES[mes - 1]} ${anio}`,
    mesCorto: MESES_CORTOS_ES[mes - 1],
  };
}

export function periodoActual(hoy: Date = new Date()): PeriodoCumpleanos {
  return construirPeriodo(hoy.getFullYear(), hoy.getMonth() + 1);
}

/** Convierte `AAAA-MM` en período. Sin valor, usa el mes actual. */
export function parsePeriodo(mes?: string, hoy: Date = new Date()): PeriodoCumpleanos {
  if (!mes) return periodoActual(hoy);
  const [anio, numeroMes] = mes.split('-').map(Number);
  return construirPeriodo(anio, numeroMes);
}

function fechaLocal(iso: string): Date | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!partes) return null;
  const anio = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  const fecha = new Date(anio, mes - 1, dia);
  if (
    fecha.getFullYear() !== anio ||
    fecha.getMonth() !== mes - 1 ||
    fecha.getDate() !== dia
  ) {
    return null;
  }
  return fecha;
}

export type Membresia = {
  anios: number;
  meses: number;
  texto: string;
};

/**
 * Antigüedad desde la fecha de ingreso hasta la referencia (hoy por defecto).
 * Devuelve null si no hay fecha o si la fecha es futura.
 */
export function calcularMembresia(
  fechaIngreso: string | null | undefined,
  referencia: Date = new Date(),
): Membresia | null {
  if (!fechaIngreso) return null;
  const ingreso = fechaLocal(fechaIngreso);
  if (!ingreso) return null;
  if (ingreso > referencia) return null;

  let anios = referencia.getFullYear() - ingreso.getFullYear();
  let meses = referencia.getMonth() + 1 - (ingreso.getMonth() + 1);

  // Si todavía no llega el día del mes del ingreso, el último mes no se cumple.
  if (referencia.getDate() < ingreso.getDate()) meses -= 1;

  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }
  if (anios < 0) return null;

  const partes: string[] = [];
  if (anios > 0) partes.push(`${anios} ${anios === 1 ? 'año' : 'años'}`);
  if (meses > 0) partes.push(`${meses} ${meses === 1 ? 'mes' : 'meses'}`);

  return {
    anios,
    meses,
    texto: partes.length > 0 ? partes.join(' y ') : 'menos de un mes',
  };
}

/** Edad que cumple en el año indicado (o null si la fecha no sirve). */
export function calcularEdadCumple(
  fechaNacimiento: string | null | undefined,
  anioCumple: number,
): number | null {
  if (!fechaNacimiento) return null;
  const nacimiento = fechaLocal(fechaNacimiento);
  if (!nacimiento) return null;
  const edad = anioCumple - nacimiento.getFullYear();
  return edad >= 0 ? edad : null;
}

/** Verdadero si hoy es el día y mes del cumpleaños. */
export function esCumpleHoy(
  fechaNacimiento: string | null | undefined,
  hoy: Date = new Date(),
): boolean {
  if (!fechaNacimiento) return false;
  const nacimiento = fechaLocal(fechaNacimiento);
  if (!nacimiento) return false;
  return (
    nacimiento.getDate() === hoy.getDate() && nacimiento.getMonth() === hoy.getMonth()
  );
}

/** Primera palabra del nombre, para saludar de forma cercana. */
export function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}
