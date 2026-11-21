import { z } from 'zod';

/**
 * RUT chileno normalizado: sin puntos ni guion, dígito verificador al final.
 * Ejemplos válidos: 17682512K, 127556636, 152426674.
 */
export const rutSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^\d{7,8}[0-9K]$/, 'RUT inválido: debe ser 7-8 dígitos más dígito verificador');

/**
 * Período de cuota en formato AAAA-MM (ej. 2026-11).
 */
export const periodoSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Período inválido: debe ser AAAA-MM');

/**
 * Nombre de socio: entre 2 y 160 caracteres, letras y espacios.
 */
export const nombreSchema = z
  .string()
  .trim()
  .min(2, 'Nombre muy corto')
  .max(160, 'Nombre muy largo');

/**
 * Monto en CLP: entero no negativo.
 */
export const montoClpSchema = z
  .number()
  .int('El monto debe ser un entero (CLP sin decimales)')
  .nonnegative('El monto no puede ser negativo');

/**
 * Sexo del socio: catálogo cerrado, en mayúsculas en la base.
 * En la UI se muestran las etiquetas de `SEXO_SOCIO_LABELS`.
 */
export const SEXOS_SOCIO = ['HOMBRE', 'MUJER', 'INDEFINIDO'] as const;

export type SexoSocio = (typeof SEXOS_SOCIO)[number];

export const SEXO_SOCIO_LABELS: Record<SexoSocio, string> = {
  HOMBRE: 'Hombre',
  MUJER: 'Mujer',
  INDEFINIDO: 'Indefinido',
};

export const sexoSocioSchema = z.enum(SEXOS_SOCIO);

/**
 * Estado del socio en el padrón. Se deja como string acotado para no
 * romper datos históricos (ACTIVO, MEMBRESIA, BECADO).
 */
export const estadoSocioSchema = z.string().trim().min(1).max(30);

// ---------------------------------------------------------------------------
// Fechas (AAAA-MM-DD) y dirección
// ---------------------------------------------------------------------------

const FECHA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Verdadero si el texto es una fecha calendario real (rechaza 2026-02-31). */
export function esFechaISO(valor: string): boolean {
  if (!FECHA_ISO_RE.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

/** Hoy en la zona local del proceso, como AAAA-MM-DD. */
export function fechaHoyISO(): string {
  const hoy = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${hoy.getFullYear()}-${dos(hoy.getMonth() + 1)}-${dos(hoy.getDate())}`;
}

/** Fecha calendario opcional. Se recibe y devuelve como AAAA-MM-DD. */
export const fechaISO = z
  .string()
  .trim()
  .regex(FECHA_ISO_RE, 'Fecha inválida: usa AAAA-MM-DD')
  .refine(esFechaISO, 'La fecha no existe en el calendario');

export const fechaNacimientoSchema = fechaISO
  .refine((v) => v >= '1900-01-01', 'Fecha de nacimiento demasiado antigua')
  .refine((v) => v <= fechaHoyISO(), 'La fecha de nacimiento no puede ser futura');

export const fechaIngresoSchema = fechaISO
  .refine((v) => v >= '1950-01-01', 'Fecha de ingreso demasiado antigua')
  .refine((v) => v <= fechaHoyISO(), 'La fecha de ingreso no puede ser futura');

export const direccionSchema = z
  .string()
  .trim()
  .min(3, 'Dirección muy corta')
  .max(255, 'Dirección muy larga');

// En el alta, "" y null significan "sin dato": se normalizan a undefined.
const fechaNacimientoAlta = z
  .union([fechaNacimientoSchema, z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === '' || v === null ? undefined : v));

const fechaIngresoAlta = z
  .union([fechaIngresoSchema, z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === '' || v === null ? undefined : v));

const direccionAlta = z
  .union([direccionSchema, z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === '' || v === null ? undefined : v));

const sexoAlta = z
  .union([sexoSocioSchema, z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === '' || v === null ? undefined : v));

// En la edición, "" y null borran el dato: se normalizan a null.
const fechaNacimientoEditable = z
  .union([fechaNacimientoSchema, z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === '' ? null : v));

const fechaIngresoEditable = z
  .union([fechaIngresoSchema, z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === '' ? null : v));

const direccionEditable = z
  .union([direccionSchema, z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === '' ? null : v));

const sexoEditable = z
  .union([sexoSocioSchema, z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === '' ? null : v));

export const tipoCuotaSchema = z.enum(['ACTIVO', 'MEMBRESIA', 'BECADO', 'OTRO']);

export const origenPagoSchema = z.enum(['manual', 'banco', 'historico']);

export const rolSchema = z.enum(['DIRECTIVA', 'TESORERO', 'SOCIO']);

export const estadoPagoSchema = z.enum(['PENDIENTE', 'APROBADO', 'RECHAZADO']);

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

const socioBase = {
  rut: rutSchema,
  nombre: nombreSchema,
  anio: z.number().int().min(2020).max(2100),
  sexo: sexoAlta,
  fechaNacimiento: fechaNacimientoAlta,
  fechaIngreso: fechaIngresoAlta,
  direccion: direccionAlta,
  estado: estadoSocioSchema.optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefono: z.string().trim().max(30).optional(),
};

export const crearSocioSchema = z.object(socioBase);

/**
 * Edición de socio: mismos campos que el alta, todos opcionales, pero al
 * menos uno debe venir (no se acepta un PATCH vacío).
 *
 * `activo` NO se edita por aquí: es estado server-owned. La baja es una
 * transición controlada (DELETE → activo=0) y la reactivación será una acción
 * administrativa explícita, no un campo libre del cliente.
 */
export const actualizarSocioSchema = z
  .object({
    rut: rutSchema.optional(),
    nombre: nombreSchema.optional(),
    anio: z.number().int().min(2020).max(2100).optional(),
    sexo: sexoEditable,
    fechaNacimiento: fechaNacimientoEditable,
    fechaIngreso: fechaIngresoEditable,
    direccion: direccionEditable,
    estado: estadoSocioSchema.optional(),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    telefono: z.string().trim().max(30).optional().or(z.literal('')),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nada que actualizar');

/**
 * Query de listado de socios: búsqueda y filtros opcionales, con paginación.
 */
export const listarSociosQuerySchema = z.object({
  q: z.string().trim().max(160).optional(),
  estado: z.string().trim().max(30).optional(),
  activo: z
    .enum(['0', '1'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === '1')),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
});

export const crearNivelCuotaSchema = z.object({
  codigo: z.string().trim().min(1).max(20),
  nombre: z.string().trim().min(1).max(80),
  montoClp: montoClpSchema,
  tipo: tipoCuotaSchema,
});

/**
 * Edición de un nivel de cuota: campos opcionales, al menos uno requerido.
 */
export const actualizarNivelCuotaSchema = z
  .object({
    codigo: z.string().trim().min(1).max(20).optional(),
    nombre: z.string().trim().min(1).max(80).optional(),
    montoClp: montoClpSchema.optional(),
    tipo: tipoCuotaSchema.optional(),
    activo: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nada que actualizar');

export const crearPagoSchema = z.object({
  socioId: z.number().int().positive(),
  rut: rutSchema,
  nombreSnapshot: nombreSchema,
  anio: z.number().int().min(2020).max(2100),
  sexo: z.string().trim().max(20).optional(),
  estado: estadoSocioSchema.optional(),
  situacion: z.string().trim().max(30).optional(),
  fechaPago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida: AAAA-MM-DD'),
  totalPago: montoClpSchema,
  valorCuota: montoClpSchema,
  tipoCuota: tipoCuotaSchema,
  mesesCantidad: z.number().int().min(1).max(12),
  mesesDetalle: z.string().max(120).optional(),
  observacion: z.string().max(255).optional(),
  origen: origenPagoSchema.optional(),
});

/**
 * Query de listado de pagos: filtro por estado, socio, paginación.
 */
export const listarPagosQuerySchema = z.object({
  estado: z.enum(['PENDIENTE', 'APROBADO', 'RECHAZADO']).optional(),
  socioId: z.number().int().positive().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
});

/**
 * Aprobación / rechazo de un pago pendiente.
 */
export const actualizarPagoSchema = z.object({
  estado: z.enum(['APROBADO', 'RECHAZADO']),
  motivo: z.string().max(255).optional(),
});

export const crearCuentaBancariaSchema = z.object({
  banco: z.string().trim().min(1).max(80),
  tipo: z.string().trim().min(1).max(30),
  numero: z.string().trim().min(1).max(40),
  titular: z.string().trim().min(1).max(160),
  rut: rutSchema,
  email: z.string().email('Email inválido').optional().or(z.literal('')),
});

/**
 * Edición de una cuenta bancaria: mismos campos, todos opcionales,
 * pero al menos uno debe venir.
 */
export const actualizarCuentaBancariaSchema = z
  .object({
    banco: z.string().trim().min(1).max(80).optional(),
    tipo: z.string().trim().min(1).max(30).optional(),
    numero: z.string().trim().min(1).max(40).optional(),
    titular: z.string().trim().min(1).max(160).optional(),
    rut: rutSchema.optional(),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nada que actualizar');

/**
 * Día de vencimiento de una cuota (1–31). La validez del día en meses cortos
 * (febrero) se valida al usar el período, no en el rango 1–31.
 */
export const diaVencimientoSchema = z
  .number()
  .int('El día de vencimiento debe ser entero')
  .min(1, 'Día mínimo 1')
  .max(31, 'Día máximo 31');

/**
 * Creación de un período de cuota: mes (AAAA-MM) + día de vencimiento.
 */
export const crearPeriodoCuotaSchema = z.object({
  periodo: periodoSchema,
  diaVencimiento: diaVencimientoSchema,
});

/**
 * Comprobante de pago: validación de archivo subido.
 * El servidor valida MIME y tamaño; aquí solo definimos la estructura del DTO.
 */
export const crearComprobanteSchema = z.object({
  pagoId: z.number().int().positive(),
  nombreArchivo: z.string().trim().min(1).max(255),
  mime: z.string().trim().min(1).max(100),
  bytes: z.number().int().positive(),
  sha256: z.string().length(64, 'SHA256 debe tener 64 caracteres hex'),
});

export const actualizarComprobanteSchema = z
  .object({
    estado: z.enum(['PENDIENTE', 'APROBADO', 'RECHAZADO']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nada que actualizar');

export const crearEgresoSchema = z.object({
  categoriaId: z.number().int().positive().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monto: montoClpSchema,
  descripcion: z.string().trim().min(1).max(255),
});

/**
 * Actualización de egreso: todos los campos opcionales, al menos uno requerido.
 */
export const actualizarEgresoSchema = z
  .object({
    categoriaId: z.number().int().positive().optional(),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    monto: montoClpSchema.optional(),
    descripcion: z.string().trim().min(1).max(255).optional(),
    boletaRuta: z.string().max(255).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nada que actualizar');

/**
 * Categoría de egreso.
 */
export const crearCategoriaEgresoSchema = z.object({
  nombre: z.string().trim().min(1).max(80),
});

export const actualizarCategoriaEgresoSchema = z.object({
  nombre: z.string().trim().min(1).max(80).optional(),
}).refine((v) => Object.keys(v).length > 0, 'Nada que actualizar');

/**
 * Gasto fijo (recurrente).
 */
export const crearGastoFijoSchema = z.object({
  descripcion: z.string().trim().min(1).max(160),
  monto: montoClpSchema,
  periodicidad: z.enum(['mensual', 'trimestral', 'semestral', 'anual']),
});

export const actualizarGastoFijoSchema = z.object({
  descripcion: z.string().trim().min(1).max(160).optional(),
  monto: montoClpSchema.optional(),
  periodicidad: z.enum(['mensual', 'trimestral', 'semestral', 'anual']).optional(),
  activo: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, 'Nada que actualizar');

/**
 * Otro ingreso (rifas, donaciones, etc.).
 */
export const crearOtroIngresoSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monto: montoClpSchema,
  descripcion: z.string().trim().min(1).max(255),
  origen: z.string().trim().max(60).optional(),
});

export const actualizarOtroIngresoSchema = z
  .object({
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    monto: montoClpSchema.optional(),
    descripcion: z.string().trim().min(1).max(255).optional(),
    origen: z.string().trim().max(60).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nada que actualizar');

/**
 * Configuración del club.
 */
export const actualizarConfigClubSchema = z.object({
  nombre: z.string().trim().min(1).max(160).optional(),
  logoUrl: z.string().url('URL de logo inválida').optional().or(z.literal('')),
  direccion: z.string().trim().max(255).optional(),
  telefono: z.string().trim().max(30).optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  emailTesoreria: z.string().email('Email tesorería inválido').optional().or(z.literal('')),
  metaMensual: montoClpSchema.optional(),
}).refine((v) => Object.keys(v).length > 0, 'Nada que actualizar');

/**
 * Usuario/Rol.
 */
export const crearUsuarioRolSchema = z.object({
  userId: z.string().uuid('userId debe ser UUID válido'),
  rol: rolSchema,
});

export const actualizarUsuarioRolSchema = z.object({
  rol: rolSchema.optional(),
}).refine((v) => Object.keys(v).length > 0, 'Nada que actualizar');

/**
 * Importación de socios (Excel .xlsx o CSV).
 */
export const importarSociosSchema = z.object({
  socios: z.array(z.object({
    rut: rutSchema,
    nombre: nombreSchema,
    anio: z.number().int().min(2020).max(2100),
    sexo: sexoSocioSchema.optional(),
    fechaNacimiento: fechaNacimientoSchema.optional(),
    fechaIngreso: fechaIngresoSchema.optional(),
    direccion: direccionSchema.optional(),
    estado: estadoSocioSchema.optional(),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    telefono: z.string().trim().max(30).optional(),
    activo: z.boolean().optional(),
  })).min(1, 'Debe haber al menos un socio'),
});

/**
 * Query de reportes.
 */
export const reporteBalanceQuerySchema = z.object({
  periodo: periodoSchema.optional(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  formato: z.enum(['json', 'xlsx', 'pdf']).optional(),
}).refine((v) => v.periodo || (v.desde && v.hasta), 'Debe especificar periodo o rango desde/hasta');

/**
 * Query de panel/KPIs.
 */
export const panelKpisQuerySchema = z.object({
  mes: periodoSchema.optional(), // AAAA-MM, default mes actual
});

/**
 * Subida de logo del club.
 */
export const subirLogoSchema = z.object({
  nombreArchivo: z.string().trim().min(1).max(255),
  mime: z.string().trim().min(1).max(100),
  bytes: z.number().int().positive(),
  sha256: z.string().length(64, 'SHA256 debe tener 64 caracteres hex'),
});

/**
 * Query listado egresos.
 */
export const listarEgresosQuerySchema = z.object({
  q: z.string().trim().max(160).optional(),
  categoriaId: z.number().int().positive().optional(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
});

/**
 * Query listado otros ingresos.
 */
export const listarOtrosIngresosQuerySchema = z.object({
  q: z.string().trim().max(160).optional(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
});

/**
 * Query listado gastos fijos.
 */
export const listarGastosFijosQuerySchema = z.object({
  activo: z.enum(['0', '1']).optional().transform((v) => v === undefined ? undefined : v === '1'),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
});

export type CrearSocioInput = z.infer<typeof crearSocioSchema>;
export type ActualizarSocioInput = z.infer<typeof actualizarSocioSchema>;
export type ListarSociosQuery = z.infer<typeof listarSociosQuerySchema>;
export type CrearPagoInput = z.infer<typeof crearPagoSchema>;
export type ListarPagosQuery = z.infer<typeof listarPagosQuerySchema>;
export type ActualizarPagoInput = z.infer<typeof actualizarPagoSchema>;
export type CrearCuentaBancariaInput = z.infer<typeof crearCuentaBancariaSchema>;
export type ActualizarCuentaBancariaInput = z.infer<typeof actualizarCuentaBancariaSchema>;
export type CrearPeriodoCuotaInput = z.infer<typeof crearPeriodoCuotaSchema>;
export type CrearNivelCuotaInput = z.infer<typeof crearNivelCuotaSchema>;
export type ActualizarNivelCuotaInput = z.infer<typeof actualizarNivelCuotaSchema>;
export type CrearComprobanteInput = z.infer<typeof crearComprobanteSchema>;
export type ActualizarComprobanteInput = z.infer<typeof actualizarComprobanteSchema>;
export type CrearEgresoInput = z.infer<typeof crearEgresoSchema>;
export type ActualizarEgresoInput = z.infer<typeof actualizarEgresoSchema>;
export type CrearCategoriaEgresoInput = z.infer<typeof crearCategoriaEgresoSchema>;
export type ActualizarCategoriaEgresoInput = z.infer<typeof actualizarCategoriaEgresoSchema>;
export type CrearGastoFijoInput = z.infer<typeof crearGastoFijoSchema>;
export type ActualizarGastoFijoInput = z.infer<typeof actualizarGastoFijoSchema>;
export type CrearOtroIngresoInput = z.infer<typeof crearOtroIngresoSchema>;
export type ActualizarOtroIngresoInput = z.infer<typeof actualizarOtroIngresoSchema>;
export type ActualizarConfigClubInput = z.infer<typeof actualizarConfigClubSchema>;
export type CrearUsuarioRolInput = z.infer<typeof crearUsuarioRolSchema>;
export type ActualizarUsuarioRolInput = z.infer<typeof actualizarUsuarioRolSchema>;
export type ImportarSociosInput = z.infer<typeof importarSociosSchema>;
export type ReporteBalanceQuery = z.infer<typeof reporteBalanceQuerySchema>;
export type PanelKpisQuery = z.infer<typeof panelKpisQuerySchema>;
export type ListarEgresosQuery = z.infer<typeof listarEgresosQuerySchema>;
export type ListarOtrosIngresosQuery = z.infer<typeof listarOtrosIngresosQuerySchema>;
export type ListarGastosFijosQuery = z.infer<typeof listarGastosFijosQuerySchema>;
export type SubirLogoInput = z.infer<typeof subirLogoSchema>;
