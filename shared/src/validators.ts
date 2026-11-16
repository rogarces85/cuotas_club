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
 * Sexo / estado de un socio. Se dejan como string libre por ahora,
 * heredando los valores ya presentes en los datos (ACTIVO, MEMBRESIA).
 */
export const estadoSocioSchema = z.string().trim().min(1).max(30);

export const tipoCuotaSchema = z.enum(['ACTIVO', 'MEMBRESIA', 'BECADO', 'OTRO']);

export const origenPagoSchema = z.enum(['manual', 'banco', 'historico']);

export const rolSchema = z.enum(['DIRECTIVA', 'TESORERO', 'SOCIO']);

export const estadoPagoSchema = z.enum(['PENDIENTE', 'APROBADO', 'RECHAZADO']);

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export const crearSocioSchema = z.object({
  rut: rutSchema,
  nombre: nombreSchema,
  anio: z.number().int().min(2020).max(2100),
  sexo: z.string().trim().max(20).optional(),
  estado: estadoSocioSchema.optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefono: z.string().trim().max(30).optional(),
});

export const crearNivelCuotaSchema = z.object({
  codigo: z.string().trim().min(1).max(20),
  nombre: z.string().trim().min(1).max(80),
  montoClp: montoClpSchema,
  tipo: tipoCuotaSchema,
});

export const crearPagoSchema = z.object({
  socioId: z.number().int().positive(),
  anio: z.number().int().min(2020).max(2100),
  fechaPago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida: AAAA-MM-DD'),
  totalPago: montoClpSchema,
  valorCuota: montoClpSchema,
  tipoCuota: tipoCuotaSchema,
  periodos: z.array(periodoSchema).min(1, 'Debe cubrir al menos un mes'),
  observacion: z.string().max(255).optional(),
  origen: origenPagoSchema.optional(),
});

export const crearCuentaBancariaSchema = z.object({
  banco: z.string().trim().min(1).max(80),
  tipo: z.string().trim().min(1).max(30),
  numero: z.string().trim().min(1).max(40),
  titular: z.string().trim().min(1).max(160),
  rut: rutSchema,
  email: z.string().email('Email inválido').optional().or(z.literal('')),
});

export const crearEgresoSchema = z.object({
  categoriaId: z.number().int().positive().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monto: montoClpSchema,
  descripcion: z.string().trim().min(1).max(255),
});

export type CrearSocioInput = z.infer<typeof crearSocioSchema>;
export type CrearPagoInput = z.infer<typeof crearPagoSchema>;
export type CrearCuentaBancariaInput = z.infer<typeof crearCuentaBancariaSchema>;
