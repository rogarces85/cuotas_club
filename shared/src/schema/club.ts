import {
  mysqlTable,
  int,
  varchar,
  smallint,
  tinyint,
  date,
  mysqlEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

/**
 * Esquema del dominio del club (no incluye las tablas de autenticación,
 * que son las que genera Better Auth en auth-schema.ts).
 *
 * Reglas heredadas del análisis:
 * - Los montos son int (CLP, sin decimales). Nunca float.
 * - El RUT se guarda normalizado: sin puntos ni guion, K en mayúscula.
 * - Un pago puede cubrir varios meses: pago (1) → pago_mes (N).
 *
 * Nota drizzle-orm 0.45: `unsigned` se pasa como config del constructor
 * (`int('id', { unsigned: true })`), no como método encadenable.
 */

// ---------------------------------------------------------------------------
// Socios
// ---------------------------------------------------------------------------

export const socio = mysqlTable(
  'socio',
  {
    id: int('id_socio', { unsigned: true }).autoincrement().primaryKey(),
    rut: varchar('rut', { length: 12 }).notNull(),
    nombre: varchar('nombre', { length: 160 }).notNull(),
    anio: smallint('anio').notNull(),
    // Valores canónicos: HOMBRE | MUJER | INDEFINIDO (validados en shared/validators.ts).
    sexo: varchar('sexo', { length: 20 }),
    fechaNacimiento: date('fecha_nacimiento', { mode: 'string' }),
    fechaIngreso: date('fecha_ingreso', { mode: 'string' }),
    direccion: varchar('direccion', { length: 255 }),
    estado: varchar('estado', { length: 30 }).notNull().default('ACTIVO'),
    activo: tinyint('activo').notNull().default(1),
    email: varchar('email', { length: 255 }),
    telefono: varchar('telefono', { length: 30 }),
    createdAt: int('created_at').notNull(),
    updatedAt: int('updated_at').notNull(),
  },
  (t) => ({
    rutIdx: uniqueIndex('socio_rut_idx').on(t.rut),
    nombreIdx: index('socio_nombre_idx').on(t.nombre),
  }),
);

// ---------------------------------------------------------------------------
// Niveles de cuota (cuánto paga cada tipo)
// ---------------------------------------------------------------------------

export const nivelCuota = mysqlTable(
  'nivel_cuota',
  {
    id: int('id', { unsigned: true }).autoincrement().primaryKey(),
    codigo: varchar('codigo', { length: 20 }).notNull(),
    nombre: varchar('nombre', { length: 80 }).notNull(),
    montoClp: int('monto_clp').notNull(),
    tipo: varchar('tipo', { length: 20 }).notNull(),
    activo: tinyint('activo').notNull().default(1),
  },
  (t) => ({
    codigoIdx: uniqueIndex('nivel_cuota_codigo_idx').on(t.codigo),
  }),
);

// ---------------------------------------------------------------------------
// Períodos de cuota (cuánto se cobra cada mes y cuándo vence)
// ---------------------------------------------------------------------------

export const periodoCuota = mysqlTable(
  'periodo_cuota',
  {
    id: int('id', { unsigned: true }).autoincrement().primaryKey(),
    periodo: varchar('periodo', { length: 7 }).notNull(), // AAAA-MM
    diaVencimiento: tinyint('dia_vencimiento').notNull(),
    createdAt: int('created_at').notNull(),
  },
  (t) => ({
    periodoIdx: uniqueIndex('periodo_cuota_periodo_idx').on(t.periodo),
  }),
);

// ---------------------------------------------------------------------------
// Pagos
// ---------------------------------------------------------------------------

export const pago = mysqlTable(
  'pago',
  {
    id: int('id_pago', { unsigned: true }).autoincrement().primaryKey(),
    codigoPago: varchar('codigo_pago', { length: 30 }),
    socioId: int('id_socio', { unsigned: true }).notNull(),
    rut: varchar('rut', { length: 12 }).notNull(),
    nombreSnapshot: varchar('nombre_snapshot', { length: 160 }).notNull(),
    anio: smallint('anio').notNull(),
    sexo: varchar('sexo', { length: 20 }),
    estado: varchar('estado', { length: 30 }).notNull().default('PENDIENTE'),
    situacion: varchar('situacion', { length: 30 }),
    fechaPago: date('fecha_pago').notNull(),
    totalPago: int('total_pago').notNull(),
    valorCuota: int('valor_cuota').notNull(),
    tipoCuota: mysqlEnum('tipo_cuota', ['ACTIVO', 'MEMBRESIA', 'BECADO', 'OTRO']).notNull(),
    mesesCantidad: int('meses_cantidad', { unsigned: true }).notNull(),
    mesesDetalle: varchar('meses_detalle', { length: 120 }),
    observacion: varchar('observacion', { length: 255 }),
    origen: mysqlEnum('origen', ['manual', 'banco', 'historico']).notNull().default('manual'),
    createdAt: int('created_at').notNull(),
    updatedAt: int('updated_at').notNull(),
  },
  (t) => ({
    socioIdx: index('pago_socio_idx').on(t.socioId),
    rutIdx: index('pago_rut_idx').on(t.rut),
    fechaIdx: index('pago_fecha_idx').on(t.fechaPago),
  }),
);

export const pagoMes = mysqlTable(
  'pago_mes',
  {
    id: int('id_pago_mes', { unsigned: true }).autoincrement().primaryKey(),
    pagoId: int('id_pago', { unsigned: true }).notNull(),
    socioId: int('id_socio', { unsigned: true }).notNull(),
    rut: varchar('rut', { length: 12 }).notNull(),
    periodo: varchar('periodo', { length: 7 }).notNull(), // AAAA-MM
    createdAt: int('created_at').notNull(),
  },
  (t) => ({
    pagoIdx: index('pago_mes_pago_idx').on(t.pagoId),
    socioPeriodoIdx: index('pago_mes_socio_periodo_idx').on(t.socioId, t.periodo),
  }),
);

// ---------------------------------------------------------------------------
// Comprobantes (archivo privado asociado a un pago)
// ---------------------------------------------------------------------------

export const comprobante = mysqlTable('comprobante', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  pagoId: int('id_pago', { unsigned: true }).notNull(),
  ruta: varchar('ruta', { length: 255 }).notNull(),
  nombreArchivo: varchar('nombre_archivo', { length: 255 }).notNull(),
  mime: varchar('mime', { length: 100 }).notNull(),
  bytes: int('bytes', { unsigned: true }).notNull(),
  sha256: varchar('sha256', { length: 64 }).notNull(),
  estado: varchar('estado', { length: 30 }).notNull().default('PENDIENTE'),
  createdAt: int('created_at').notNull(),
});

// ---------------------------------------------------------------------------
// Cuentas bancarias del club
// ---------------------------------------------------------------------------

export const cuentaBancaria = mysqlTable('cuenta_bancaria', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  banco: varchar('banco', { length: 80 }).notNull(),
  tipo: varchar('tipo', { length: 30 }).notNull(),
  numero: varchar('numero', { length: 40 }).notNull(),
  titular: varchar('titular', { length: 160 }).notNull(),
  rut: varchar('rut', { length: 12 }).notNull(),
  email: varchar('email', { length: 255 }),
  createdAt: int('created_at').notNull(),
});

// ---------------------------------------------------------------------------
// Finanzas: egresos, categorías, gastos fijos, otros ingresos
// ---------------------------------------------------------------------------

export const categoriaEgreso = mysqlTable('categoria_egreso', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  nombre: varchar('nombre', { length: 80 }).notNull(),
  createdAt: int('created_at').notNull(),
});

export const egreso = mysqlTable(
  'egreso',
  {
    id: int('id', { unsigned: true }).autoincrement().primaryKey(),
    categoriaId: int('id_categoria', { unsigned: true }),
    fecha: date('fecha').notNull(),
    monto: int('monto').notNull(),
    descripcion: varchar('descripcion', { length: 255 }).notNull(),
    boletaRuta: varchar('boleta_ruta', { length: 255 }),
    createdAt: int('created_at').notNull(),
  },
  (t) => ({
    fechaIdx: index('egreso_fecha_idx').on(t.fecha),
  }),
);

export const gastoFijo = mysqlTable('gasto_fijo', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  descripcion: varchar('descripcion', { length: 160 }).notNull(),
  monto: int('monto').notNull(),
  periodicidad: varchar('periodicidad', { length: 30 }).notNull(),
  activo: tinyint('activo').notNull().default(1),
  createdAt: int('created_at').notNull(),
});

export const otroIngreso = mysqlTable('otro_ingreso', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  fecha: date('fecha').notNull(),
  monto: int('monto').notNull(),
  descripcion: varchar('descripcion', { length: 255 }).notNull(),
  origen: varchar('origen', { length: 60 }),
  createdAt: int('created_at').notNull(),
});

// ---------------------------------------------------------------------------
// Felicitaciones de cumpleaños (una por socio y año)
// ---------------------------------------------------------------------------

export const felicitacionCumpleanos = mysqlTable(
  'felicitacion_cumpleanos',
  {
    id: int('id', { unsigned: true }).autoincrement().primaryKey(),
    socioId: int('id_socio', { unsigned: true }).notNull(),
    anio: smallint('anio').notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    enviadoAt: int('enviado_at').notNull(),
  },
  (t) => ({
    // Un solo saludo por socio y año: evita duplicados por doble clic.
    unico: uniqueIndex('felicitacion_socio_anio_idx').on(t.socioId, t.anio),
    socioIdx: index('felicitacion_socio_idx').on(t.socioId),
  }),
);

// ---------------------------------------------------------------------------
// Movimientos bancarios (cartola importada)
// ---------------------------------------------------------------------------

export const movimientoBancario = mysqlTable(
  'movimiento_bancario',
  {
    id: int('id', { unsigned: true }).autoincrement().primaryKey(),
    fecha: date('fecha').notNull(),
    monto: int('monto').notNull(),
    descripcion: varchar('descripcion', { length: 255 }).notNull(),
    referencia: varchar('referencia', { length: 120 }),
    createdAt: int('created_at').notNull(),
  },
  (t) => ({
    fechaIdx: index('mov_bancario_fecha_idx').on(t.fecha),
  }),
);

// ---------------------------------------------------------------------------
// Roles del club (la identidad vive en Better Auth; el rol, acá)
// ---------------------------------------------------------------------------

export const usuarioRol = mysqlTable(
  'usuario_rol',
  {
    id: int('id', { unsigned: true }).autoincrement().primaryKey(),
    userId: varchar('user_id', { length: 36 }).notNull(), // FK al id de Better Auth
    rol: mysqlEnum('rol', ['DIRECTIVA', 'TESORERO', 'SOCIO']).notNull(),
    createdAt: int('created_at').notNull(),
  },
  (t) => ({
    userIdx: uniqueIndex('usuario_rol_user_idx').on(t.userId),
  }),
);

// ---------------------------------------------------------------------------
// Relaciones
// ---------------------------------------------------------------------------

export const socioRelations = relations(socio, ({ many }) => ({
  pagos: many(pago),
  felicitaciones: many(felicitacionCumpleanos),
}));

export const pagoRelations = relations(pago, ({ one, many }) => ({
  socio: one(socio, { fields: [pago.socioId], references: [socio.id] }),
  meses: many(pagoMes),
  comprobantes: many(comprobante),
}));

export const pagoMesRelations = relations(pagoMes, ({ one }) => ({
  pago: one(pago, { fields: [pagoMes.pagoId], references: [pago.id] }),
}));

export const comprobanteRelations = relations(comprobante, ({ one }) => ({
  pago: one(pago, { fields: [comprobante.pagoId], references: [pago.id] }),
}));

export const egresoRelations = relations(egreso, ({ one }) => ({
  categoria: one(categoriaEgreso, {
    fields: [egreso.categoriaId],
    references: [categoriaEgreso.id],
  }),
}));

export const categoriaEgresoRelations = relations(categoriaEgreso, ({ many }) => ({
  egresos: many(egreso),
}));

export const gastoFijoRelations = relations(gastoFijo, ({ many }) => ({
  // sin relaciones por ahora
}));

export const otroIngresoRelations = relations(otroIngreso, ({ many }) => ({
  // sin relaciones por ahora
}));

export const movimientoBancarioRelations = relations(movimientoBancario, ({ many }) => ({
  // sin relaciones por ahora
}));

export const usuarioRolRelations = relations(usuarioRol, ({ many }) => ({
  // sin relaciones por ahora
}));

export const felicitacionCumpleanosRelations = relations(felicitacionCumpleanos, ({ one }) => ({
  socio: one(socio, { fields: [felicitacionCumpleanos.socioId], references: [socio.id] }),
}));

// ---------------------------------------------------------------------------
// Configuración del club
// ---------------------------------------------------------------------------

export const configClub = mysqlTable('config_club', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  clave: varchar('clave', { length: 60 }).notNull(),
  valor: varchar('valor', { length: 500 }),
  createdAt: int('created_at').notNull(),
  updatedAt: int('updated_at').notNull(),
}, (t) => ({
  claveIdx: uniqueIndex('config_club_clave_idx').on(t.clave),
}));

// Logo del club (solo uno activo)
export const logoClub = mysqlTable('logo_club', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  ruta: varchar('ruta', { length: 255 }).notNull(),
  mime: varchar('mime', { length: 100 }).notNull(),
  bytes: int('bytes', { unsigned: true }).notNull(),
  sha256: varchar('sha256', { length: 64 }).notNull(),
  activo: tinyint('activo').notNull().default(1),
  createdAt: int('created_at').notNull(),
});

export const configClubRelations = relations(configClub, ({ many }) => ({
  // sin relaciones por ahora
}));

export const logoClubRelations = relations(logoClub, ({ many }) => ({
  // sin relaciones por ahora
}));
