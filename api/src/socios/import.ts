import * as XLSX from 'xlsx';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { clubSchema } from '@cuotas-club/shared';
import {
  esFechaISO,
  fechaHoyISO,
  type SexoSocio,
} from '@cuotas-club/shared';

/**
 * Importación masiva de socios desde Excel (.xlsx/.xls) o CSV.
 *
 * El archivo es la "plantilla limpia" que se descarga desde el módulo Socios:
 * una fila por integrante, encabezados fijos y sin formato decorativo.
 *
 * Reglas:
 * - El RUT se normaliza (sin puntos ni guion, K mayúscula) y se valida con
 *   módulo 11.
 * - Las fechas aceptan AAAA-MM-DD, DD-MM-AAAA, DD/MM/AAAA y celdas de fecha
 *   nativas de Excel.
 * - `force` actualiza el socio existente con los datos presentes en el
 *   archivo; las celdas vacías conservan el valor actual.
 */

const { socio } = clubSchema;

const ahoraSec = () => Math.floor(Date.now() / 1000);

// ---------------------------------------------------------------------------
// Contrato de la plantilla
// ---------------------------------------------------------------------------

export type ColumnaPlantilla = {
  clave: string;
  encabezado: string;
  ejemplo: string;
  obligatorio: boolean;
  nota: string;
  ancho: number;
};

export const COLUMNAS_PLANTILLA: ColumnaPlantilla[] = [
  {
    clave: 'rut',
    encabezado: 'rut',
    ejemplo: '12.345.678-9',
    obligatorio: true,
    nota: 'RUT chileno con dígito verificador. Se limpia solo (sin puntos ni guion).',
    ancho: 16,
  },
  {
    clave: 'nombre',
    encabezado: 'nombre',
    ejemplo: 'Camila Andrea Rojas Muñoz',
    obligatorio: true,
    nota: 'Nombre y apellido, tal como debe aparecer en el padrón.',
    ancho: 32,
  },
  {
    clave: 'anio',
    encabezado: 'anio',
    ejemplo: '2026',
    obligatorio: true,
    nota: 'Año de la membresía que se cobra. Entre 2020 y 2100.',
    ancho: 8,
  },
  {
    clave: 'sexo',
    encabezado: 'sexo',
    ejemplo: 'MUJER',
    obligatorio: false,
    nota: 'Hombre, Mujer o Indefinido (también acepta H / F / X). Vacío = sin dato.',
    ancho: 12,
  },
  {
    clave: 'fecha_nacimiento',
    encabezado: 'fecha_nacimiento',
    ejemplo: '15-03-1990',
    obligatorio: false,
    nota: 'Fecha de nacimiento. AAAA-MM-DD o DD-MM-AAAA.',
    ancho: 18,
  },
  {
    clave: 'fecha_ingreso',
    encabezado: 'fecha_ingreso',
    ejemplo: '01-03-2021',
    obligatorio: false,
    nota: 'Fecha de ingreso al club. AAAA-MM-DD o DD-MM-AAAA.',
    ancho: 18,
  },
  {
    clave: 'direccion',
    encabezado: 'direccion',
    ejemplo: 'Av. Juan Mackenna 1234, Osorno',
    obligatorio: false,
    nota: 'Dirección particular. Máximo 255 caracteres.',
    ancho: 40,
  },
  {
    clave: 'email',
    encabezado: 'email',
    ejemplo: 'camila.rojas@correo.cl',
    obligatorio: false,
    nota: 'Correo de contacto. Vacío = sin dato.',
    ancho: 30,
  },
  {
    clave: 'telefono',
    encabezado: 'telefono',
    ejemplo: '+56 9 1234 5678',
    obligatorio: false,
    nota: 'Teléfono o celular. Vacío = sin dato.',
    ancho: 18,
  },
  {
    clave: 'estado',
    encabezado: 'estado',
    ejemplo: 'ACTIVO',
    obligatorio: false,
    nota: 'ACTIVO, MEMBRESIA o BECADO. Vacío = ACTIVO.',
    ancho: 15,
  },
  {
    clave: 'activo',
    encabezado: 'activo',
    ejemplo: '1',
    obligatorio: false,
    nota: '1 = vigente en el padrón, 0 = dado de baja. Vacío = 1.',
    ancho: 9,
  },
];

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type FilaImportada = {
  fila: number;
  rut: string;
  nombre: string;
  anio: number;
  sexo: SexoSocio | null;
  fechaNacimiento: string | null;
  fechaIngreso: string | null;
  direccion: string | null;
  email: string | null;
  telefono: string | null;
  estado: string | null;
  activo: 0 | 1 | null;
};

export type ResultadoImportacion = {
  simulado: boolean;
  totalFilas: number;
  validos: number;
  insertados: number;
  actualizados: number;
  saltados: number;
  errores: number;
  detalleErrores: string[];
};

export class ErrorImportacion extends Error {
  detalle: string[];

  constructor(mensaje: string, detalle: string[] = []) {
    super(mensaje);
    this.name = 'ErrorImportacion';
    this.detalle = detalle;
  }
}

// ---------------------------------------------------------------------------
// Normalizadores
// ---------------------------------------------------------------------------

function sinAcentos(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor).replace(/\s+/g, ' ').trim();
}

function normalizarClave(valor: string): string {
  return sinAcentos(valor)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const ALIAS_COLUMNAS: Record<string, string> = {
  rut: 'rut',
  rut_socio: 'rut',
  nombre: 'nombre',
  nombre_completo: 'nombre',
  socio: 'nombre',
  anio: 'anio',
  ano: 'anio',
  agno: 'anio',
  anio_membresia: 'anio',
  sexo: 'sexo',
  genero: 'sexo',
  fecha_nacimiento: 'fecha_nacimiento',
  fecha_de_nacimiento: 'fecha_nacimiento',
  fecha_nac: 'fecha_nacimiento',
  nacimiento: 'fecha_nacimiento',
  fecha_ingreso: 'fecha_ingreso',
  fecha_de_ingreso: 'fecha_ingreso',
  ingreso: 'fecha_ingreso',
  direccion: 'direccion',
  domicilio: 'direccion',
  email: 'email',
  correo: 'email',
  e_mail: 'email',
  mail: 'email',
  telefono: 'telefono',
  fono: 'telefono',
  celular: 'telefono',
  estado: 'estado',
  activo: 'activo',
  vigente: 'activo',
};

function claveColumna(encabezado: string): string {
  const normal = normalizarClave(encabezado);
  return ALIAS_COLUMNAS[normal] ?? normal;
}

export function normalizarRut(valor: string): string {
  return valor.replace(/[.\-\s]/g, '').toUpperCase();
}

/** Valida el dígito verificador del RUT con el algoritmo módulo 11. */
export function rutValido(rut: string): boolean {
  const normalizado = normalizarRut(rut);
  if (!/^\d{7,8}[0-9K]$/.test(normalizado)) return false;

  const cuerpo = normalizado.slice(0, -1);
  const dv = normalizado.slice(-1);
  let suma = 0;
  let multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  const resto = 11 - (suma % 11);
  const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
  return dv === esperado;
}

function normalizarSexo(valor: string): SexoSocio | null {
  const limpio = sinAcentos(valor).toUpperCase().replace(/[^A-Z]/g, '');
  if (!limpio) return null;
  if (['HOMBRE', 'H', 'MASCULINO', 'VARON'].includes(limpio)) return 'HOMBRE';
  if (['MUJER', 'F', 'FEMENINO', 'FEMENINA'].includes(limpio)) return 'MUJER';
  if (['INDEFINIDO', 'INDEFINIDA', 'X', 'OTRO', 'OTRA', 'NB', 'NOBINARIO'].includes(limpio)) {
    return 'INDEFINIDO';
  }
  throw new Error(`sexo "${valor}" no válido (usa Hombre, Mujer o Indefinido)`);
}

function normalizarEstado(valor: string): string | null {
  const limpio = sinAcentos(valor).toUpperCase().trim();
  if (!limpio) return null;
  if (['ACTIVO', 'ACTIVA'].includes(limpio)) return 'ACTIVO';
  if (['MEMBRESIA', 'MEMBRESÍA', 'MEMBRESIAS'].includes(limpio)) return 'MEMBRESIA';
  if (['BECADO', 'BECADA'].includes(limpio)) return 'BECADO';
  throw new Error(`estado "${valor}" no válido (usa ACTIVO, MEMBRESIA o BECADO)`);
}

function normalizarActivo(valor: unknown): 0 | 1 | null {
  const limpio = sinAcentos(texto(valor)).toUpperCase();
  if (!limpio) return null;
  if (['1', 'TRUE', 'VERDADERO', 'SI', 'SÍ', 'X', 'ACTIVO', 'VIGENTE'].includes(limpio)) return 1;
  if (['0', 'FALSE', 'FALSO', 'NO', 'INACTIVO', 'BAJA'].includes(limpio)) return 0;
  throw new Error(`activo "${texto(valor)}" no válido (usa 1 o 0)`);
}

type FechaParseada = { valor: string | null; error?: string };

/** Convierte una celda de Excel/CSV en fecha AAAA-MM-DD (o null). */
export function normalizarFecha(valor: unknown): FechaParseada {
  if (valor === null || valor === undefined || valor === '') return { valor: null };

  if (typeof valor === 'number') {
    // Los años escritos en una celda de fecha son un error frecuente.
    if (valor >= 1900 && valor <= 2100) {
      return { valor: null, error: 'parece un año, no una fecha (usa AAAA-MM-DD)' };
    }
    const partes = XLSX.SSF.parse_date_code(valor);
    if (!partes || !partes.y) return { valor: null, error: 'fecha de Excel inválida' };
    const iso = `${String(partes.y).padStart(4, '0')}-${String(partes.m).padStart(2, '0')}-${String(partes.d).padStart(2, '0')}`;
    return esFechaISO(iso) ? { valor: iso } : { valor: null, error: 'fecha fuera de rango' };
  }

  const original = texto(valor);
  if (!original) return { valor: null };

  // Acepta ISO con o sin hora, y el formato chileno DD-MM-AAAA / DD/MM/AAAA.
  let anio = '';
  let mes = '';
  let dia = '';

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/.exec(original);
  if (iso) {
    anio = iso[1];
    mes = iso[2].padStart(2, '0');
    dia = iso[3].padStart(2, '0');
  } else {
    const chilena = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(original);
    if (!chilena) return { valor: null, error: 'formato no reconocido (usa AAAA-MM-DD o DD-MM-AAAA)' };
    dia = chilena[1].padStart(2, '0');
    mes = chilena[2].padStart(2, '0');
    anio = chilena[3];
  }

  const resultado = `${anio}-${mes}-${dia}`;
  if (!esFechaISO(resultado)) return { valor: null, error: 'la fecha no existe en el calendario' };
  if (resultado < '1900-01-01' || resultado > fechaHoyISO()) {
    return { valor: null, error: 'la fecha está fuera del rango permitido' };
  }
  return { valor: resultado };
}

// ---------------------------------------------------------------------------
// Plantilla descargable
// ---------------------------------------------------------------------------

/**
 * Genera la plantilla limpia de importación.
 *
 * - Hoja "Socios": solo encabezados, una fila por integrante y anchos legibles.
 * - Hoja "Ejemplos": un registro completo y una fila por campo con su formato.
 * - Hoja "Instrucciones": pasos y valores permitidos.
 */
export function generarPlantillaSocios(): Buffer {
  const libro = XLSX.utils.book_new();

  const encabezados = COLUMNAS_PLANTILLA.map((c) => c.encabezado);
  const hojaSocios = XLSX.utils.aoa_to_sheet([encabezados]);
  hojaSocios['!cols'] = COLUMNAS_PLANTILLA.map((c) => ({ wch: c.ancho }));
  hojaSocios['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: 0, c: COLUMNAS_PLANTILLA.length - 1 },
    }),
  };
  XLSX.utils.book_append_sheet(libro, hojaSocios, 'Socios');

  const filaEjemplo = COLUMNAS_PLANTILLA.map((c) => c.ejemplo);
  const hojaEjemplos = XLSX.utils.aoa_to_sheet([
    encabezados,
    filaEjemplo,
    [],
    ['Campo', 'Ejemplo', '¿Obligatorio?', 'Formato / nota'],
    ...COLUMNAS_PLANTILLA.map((c) => [c.encabezado, c.ejemplo, c.obligatorio ? 'Sí' : 'No', c.nota]),
  ]);
  hojaEjemplos['!cols'] = [
    { wch: 22 },
    { wch: 34 },
    { wch: 13 },
    { wch: 70 },
  ];
  XLSX.utils.book_append_sheet(libro, hojaEjemplos, 'Ejemplos');

  const hojaInstrucciones = XLSX.utils.aoa_to_sheet([
    ['CÓMO IMPORTAR SOCIOS EN OSORNO RUNNERS'],
    [],
    ['1', 'Llena la hoja "Socios". Una fila por integrante. No cambies los encabezados.'],
    ['2', 'Las columnas rut, nombre y anio son obligatorias. El resto es opcional.'],
    ['3', 'Puedes escribir las fechas como AAAA-MM-DD o DD-MM-AAAA.'],
    ['4', 'El sexo acepta Hombre, Mujer o Indefinido (también H, F o X).'],
    ['5', 'Guarda el archivo como .xlsx y súbelo desde Socios → Importar.'],
    ['6', 'Revisa el resumen antes de confirmar: verás cuántos se crean y cuántos se actualizan.'],
    [],
    ['Valores permitidos'],
    ['sexo', 'Hombre · Mujer · Indefinido (vacío = sin dato)'],
    ['estado', 'ACTIVO · MEMBRESIA · BECADO (vacío = ACTIVO)'],
    ['activo', '1 = vigente · 0 = dado de baja (vacío = 1)'],
    ['anio', 'Año de la membresía que se cobra, entre 2020 y 2100.'],
    [],
    ['Si un RUT ya existe'],
    ['Sin marcar "Actualizar socios existentes", las filas repetidas se omiten.'],
    ['Con la casilla marcada, se actualizan solo las celdas con datos: las vacías no borran lo que ya había.'],
  ]);
  hojaInstrucciones['!cols'] = [{ wch: 8 }, { wch: 86 }];
  XLSX.utils.book_append_sheet(libro, hojaInstrucciones, 'Instrucciones');

  const salida = XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.isBuffer(salida) ? salida : Buffer.from(salida as ArrayBuffer);
}

// ---------------------------------------------------------------------------
// Lectura del archivo
// ---------------------------------------------------------------------------

type FilaCruda = { fila: number; datos: Record<string, unknown> };

function filasDesdeXlsx(buffer: Buffer): FilaCruda[] {
  const libro = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const nombreHoja =
    libro.SheetNames.find((n) => normalizarClave(n) === 'socios') ?? libro.SheetNames[0];
  if (!nombreHoja) throw new ErrorImportacion('El archivo Excel no tiene hojas');

  const hoja = libro.Sheets[nombreHoja];
  const registros = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, {
    defval: '',
    raw: true,
  });

  return registros.map((registro, indice) => {
    const datos: Record<string, unknown> = {};
    for (const [encabezado, valor] of Object.entries(registro)) {
      datos[claveColumna(encabezado)] = valor;
    }
    return { fila: indice + 2, datos };
  });
}

async function filasDesdeCsv(buffer: Buffer): Promise<FilaCruda[]> {
  const contenido = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const primerSalto = contenido.indexOf('\n');
  const cabecera = primerSalto >= 0 ? contenido.slice(0, primerSalto) : contenido;
  const delimitador = cabecera.includes(';') && !cabecera.includes(',') ? ';' : ',';

  const { parse } = await import('csv-parse/sync');
  let registros: Record<string, unknown>[];
  try {
    registros = parse(contenido, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter: delimitador,      relax_column_count: true,
    }) as Record<string, unknown>[];
  } catch (err) {
    throw new ErrorImportacion(
      `No se pudo leer el CSV: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return registros.map((registro, indice) => {
    const datos: Record<string, unknown> = {};
    for (const [encabezado, valor] of Object.entries(registro)) {
      datos[claveColumna(encabezado)] = valor;
    }
    return { fila: indice + 2, datos };
  });
}

export async function leerArchivoSocios(
  buffer: Buffer,
  nombreArchivo: string,
): Promise<FilaCruda[]> {
  if (buffer.length === 0) throw new ErrorImportacion('El archivo está vacío');
  const esCsv = /\.csv$/i.test(nombreArchivo);
  const filas = esCsv ? await filasDesdeCsv(buffer) : filasDesdeXlsx(buffer);
  if (filas.length === 0) {
    throw new ErrorImportacion('El archivo no tiene filas de datos debajo de los encabezados');
  }
  return filas;
}

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validarFilas(filasCrudas: FilaCruda[]): {
  validos: FilaImportada[];
  errores: string[];
} {
  const validos: FilaImportada[] = [];
  const errores: string[] = [];
  const vistos = new Map<string, number>();

  const columnasPresentes = new Set<string>();
  for (const fila of filasCrudas) {
    for (const clave of Object.keys(fila.datos)) columnasPresentes.add(clave);
  }
  for (const requerida of ['rut', 'nombre', 'anio']) {
    if (!columnasPresentes.has(requerida)) {
      return {
        validos: [],
        errores: [`Falta la columna obligatoria "${requerida}" en los encabezados`],
      };
    }
  }

  for (const { fila, datos } of filasCrudas) {
    // Fila completamente vacía: se ignora sin reportar error.
    if (Object.values(datos).every((v) => texto(v) === '')) continue;

    const erroresFila: string[] = [];

    const rut = normalizarRut(texto(datos.rut));
    if (!rut) {
      erroresFila.push('falta el RUT');
    } else if (!rutValido(rut)) {
      erroresFila.push(`RUT inválido "${texto(datos.rut)}" (revisa el dígito verificador)`);
    }

    const nombre = texto(datos.nombre);
    if (nombre.length < 2) erroresFila.push('falta el nombre');
    if (nombre.length > 160) erroresFila.push('el nombre supera 160 caracteres');

    const anioTexto = texto(datos.anio);
    const anio = Number(anioTexto);
    if (!anioTexto) {
      erroresFila.push('falta el año (anio)');
    } else if (!Number.isInteger(anio) || anio < 2020 || anio > 2100) {
      erroresFila.push(`año inválido "${anioTexto}" (debe estar entre 2020 y 2100)`);
    }

    let sexo: SexoSocio | null = null;
    try {
      sexo = normalizarSexo(texto(datos.sexo));
    } catch (err) {
      erroresFila.push(err instanceof Error ? err.message : String(err));
    }

    const fechaNacimiento = normalizarFecha(datos.fecha_nacimiento);
    if (fechaNacimiento.error) erroresFila.push(`fecha de nacimiento: ${fechaNacimiento.error}`);
    if (fechaNacimiento.valor && fechaNacimiento.valor < '1900-01-01') {
      erroresFila.push('fecha de nacimiento: demasiado antigua');
    }

    const fechaIngreso = normalizarFecha(datos.fecha_ingreso);
    if (fechaIngreso.error) erroresFila.push(`fecha de ingreso: ${fechaIngreso.error}`);
    if (fechaIngreso.valor && fechaIngreso.valor < '1950-01-01') {
      erroresFila.push('fecha de ingreso: demasiado antigua');
    }

    const direccionTexto = texto(datos.direccion);
    if (direccionTexto.length > 255) {
      erroresFila.push('la dirección supera 255 caracteres');
    }
    const direccion = direccionTexto || null;
    const email = texto(datos.email).toLowerCase() || null;
    if (email && !EMAIL_RE.test(email)) erroresFila.push(`email inválido "${email}"`);
    if (email && email.length > 255) erroresFila.push('el email supera 255 caracteres');

    const telefonoTexto = texto(datos.telefono);
    if (telefonoTexto.length > 30) {
      erroresFila.push('el teléfono supera 30 caracteres');
    }
    const telefono = telefonoTexto || null;

    let estado: string | null = null;
    try {
      estado = normalizarEstado(texto(datos.estado));
    } catch (err) {
      erroresFila.push(err instanceof Error ? err.message : String(err));
    }

    let activo: 0 | 1 | null = null;
    try {
      activo = normalizarActivo(datos.activo);
    } catch (err) {
      erroresFila.push(err instanceof Error ? err.message : String(err));
    }

    if (erroresFila.length > 0) {
      errores.push(`Fila ${fila}: ${erroresFila.join('; ')}`);
      continue;
    }

    const anterior = rut ? vistos.get(rut) : undefined;
    if (anterior) {
      errores.push(
        `Fila ${fila}: RUT repetido en el archivo (ya aparece en la fila ${anterior})`,
      );
      continue;
    }
    if (rut) vistos.set(rut, fila);

    validos.push({
      fila,
      rut,
      nombre: nombre.replace(/\s+/g, ' ').trim(),
      anio,
      sexo,
      fechaNacimiento: fechaNacimiento.valor,
      fechaIngreso: fechaIngreso.valor,
      direccion,
      email,
      telefono,
      estado,
      activo,
    });
  }

  return { validos, errores };
}

// ---------------------------------------------------------------------------
// Escritura en la base
// ---------------------------------------------------------------------------

async function persistir(
  filas: FilaImportada[],
  force: boolean,
): Promise<{ insertados: number; actualizados: number; saltados: number }> {
  // Toda la importación entra en una transacción: si algo falla a mitad de
  // camino, el padrón queda como estaba (nunca a medio importar).
  return db.transaction(async (tx) => {
    const ts = ahoraSec();
    const ruts = filas.map((f) => f.rut);
    const existentes =
      ruts.length > 0
        ? await tx.select({ rut: socio.rut }).from(socio).where(inArray(socio.rut, ruts))
        : [];
    const existentesSet = new Set(existentes.map((e) => e.rut));

    const nuevas: (typeof socio.$inferInsert)[] = [];
    let actualizados = 0;
    let saltados = 0;

    for (const fila of filas) {
      if (existentesSet.has(fila.rut)) {
        if (!force) {
          saltados++;
          continue;
        }

        // Solo se pisan las columnas con dato; una celda vacía conserva el
        // valor que ya estaba en la base.
        await tx
          .update(socio)
          .set({
            nombre: fila.nombre,
            anio: fila.anio,
            ...(fila.sexo ? { sexo: fila.sexo } : {}),
            ...(fila.fechaNacimiento ? { fechaNacimiento: fila.fechaNacimiento } : {}),
            ...(fila.fechaIngreso ? { fechaIngreso: fila.fechaIngreso } : {}),
            ...(fila.direccion ? { direccion: fila.direccion } : {}),
            ...(fila.email ? { email: fila.email } : {}),
            ...(fila.telefono ? { telefono: fila.telefono } : {}),
            ...(fila.estado ? { estado: fila.estado } : {}),
            ...(fila.activo !== null ? { activo: fila.activo } : {}),
            updatedAt: ts,
          })
          .where(eq(socio.rut, fila.rut));
        actualizados++;
        continue;
      }

      nuevas.push({
        rut: fila.rut,
        nombre: fila.nombre,
        anio: fila.anio,
        sexo: fila.sexo,
        fechaNacimiento: fila.fechaNacimiento,
        fechaIngreso: fila.fechaIngreso,
        direccion: fila.direccion,
        estado: fila.estado ?? 'ACTIVO',
        activo: fila.activo ?? 1,
        email: fila.email,
        telefono: fila.telefono,
        createdAt: ts,
        updatedAt: ts,
      });
    }

    if (nuevas.length > 0) {
      // Inserción en una sola sentencia: el padrón completo entra de una vez.
      await tx.insert(socio).values(nuevas);
    }

    return { insertados: nuevas.length, actualizados, saltados };
  });
}

/**
 * Procesa un archivo de importación. Con `dryRun` valida y cuenta sin
 * escribir nada: la UI lo usa para mostrar el resumen antes de confirmar.
 */
export async function importarDesdeArchivo(  archivo: File,
  opciones: { force: boolean; dryRun: boolean },
): Promise<ResultadoImportacion> {
  const buffer = Buffer.from(await archivo.arrayBuffer());
  const filasCrudas = await leerArchivoSocios(buffer, archivo.name || 'socios.xlsx');
  const { validos, errores } = validarFilas(filasCrudas);

  if (validos.length === 0) {
    throw new ErrorImportacion('No hay filas válidas para importar', errores.slice(0, 50));
  }

  if (opciones.dryRun) {
    const ruts = validos.map((f) => f.rut);
    const existentes = await db
      .select({ rut: socio.rut })
      .from(socio)
      .where(inArray(socio.rut, ruts));
    const cantidadExistentes = existentes.length;
    return {
      simulado: true,
      totalFilas: filasCrudas.length,
      validos: validos.length,
      insertados: validos.length - cantidadExistentes,
      actualizados: opciones.force ? cantidadExistentes : 0,
      saltados: opciones.force ? 0 : cantidadExistentes,
      errores: errores.length,
      detalleErrores: errores.slice(0, 50),
    };
  }

  const { insertados, actualizados, saltados } = await persistir(validos, opciones.force);

  return {
    simulado: false,
    totalFilas: filasCrudas.length,
    validos: validos.length,
    insertados,
    actualizados,
    saltados,
    errores: errores.length,
    detalleErrores: errores.slice(0, 50),
  };
}

/** Tamaño máximo aceptado para una planilla de importación (8 MB). */
export const MAX_BYTES_IMPORTACION = 8 * 1024 * 1024;

const EXTENSIONES_IMPORTACION = /\.(xlsx|xls|csv)$/i;

/** Lee un multipart `archivo` + `force` + `dryRun` y ejecuta la importación. */
export async function importarDesdeFormData(formData: FormData): Promise<ResultadoImportacion> {
  const archivo = formData.get('archivo');
  if (!(archivo instanceof File)) {
    throw new ErrorImportacion('No se recibió archivo (campo "archivo")');
  }
  if (archivo.size === 0) {
    throw new ErrorImportacion('El archivo está vacío');
  }
  if (archivo.size > MAX_BYTES_IMPORTACION) {
    throw new ErrorImportacion('El archivo supera el máximo de 8 MB');
  }
  if (!EXTENSIONES_IMPORTACION.test(archivo.name)) {
    throw new ErrorImportacion('Formato no permitido: sube un .xlsx, .xls o .csv');
  }

  const bandera = (nombre: string) =>
    ['true', '1', 'on', 'si', 'sí'].includes(String(formData.get(nombre) ?? '').toLowerCase());

  return importarDesdeArchivo(archivo, {
    force: bandera('force'),
    dryRun: bandera('dryRun'),
  });
}
