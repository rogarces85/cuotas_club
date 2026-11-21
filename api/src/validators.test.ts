import { describe, it, expect } from 'vitest';
import {
  crearSocioSchema,
  actualizarSocioSchema,
  listarSociosQuerySchema,
  rutSchema,
  montoClpSchema,
  periodoSchema,
  crearPeriodoCuotaSchema,
  diaVencimientoSchema,
  sexoSocioSchema,
  fechaNacimientoSchema,
  fechaIngresoSchema,
} from '@cuotas-club/shared';

/**
 * Pruebas de las reglas de validación de socios (AC4 y contratos de esquema).
 * Pura lógica, sin base de datos.
 */

describe('rutSchema', () => {
  it('acepta un RUT normalizado de 8 dígitos + K', () => {
    expect(rutSchema.parse('17682512K')).toBe('17682512K');
  });

  it('acepta un RUT con dígito verificador numérico', () => {
    expect(rutSchema.parse('127556636')).toBe('127556636');
  });

  it('normaliza a mayúsculas la K', () => {
    expect(rutSchema.parse('17682512k')).toBe('17682512K');
  });

  it('rechaza un RUT con puntos o guion (debe venir normalizado)', () => {
    expect(() => rutSchema.parse('17.682.512-K')).toThrow();
    expect(() => rutSchema.parse('17682512-K')).toThrow();
  });

  it('rechaza un RUT demasiado corto o con letra inválida', () => {
    expect(() => rutSchema.parse('123')).toThrow();
    expect(() => rutSchema.parse('17682512X')).toThrow();
  });
});

describe('crearSocioSchema', () => {
  const base = { rut: '17682512K', nombre: 'Juan Pérez', anio: 2026 };

  it('acepta un socio mínimo válido', () => {
    expect(crearSocioSchema.parse(base).nombre).toBe('Juan Pérez');
  });

  it('normaliza el RUT a mayúsculas', () => {
    expect(crearSocioSchema.parse({ ...base, rut: '17682512k' }).rut).toBe('17682512K');
  });

  it('rechaza nombre de 1 carácter', () => {
    expect(() => crearSocioSchema.parse({ ...base, nombre: 'J' })).toThrow();
  });

  it('rechaza año fuera de rango', () => {
    expect(() => crearSocioSchema.parse({ ...base, anio: 1999 })).toThrow();
    expect(() => crearSocioSchema.parse({ ...base, anio: 2101 })).toThrow();
  });

  it('acepta email válido y rechaza email inválido', () => {
    expect(crearSocioSchema.parse({ ...base, email: 'juan@test.cl' }).email).toBe('juan@test.cl');
    expect(() => crearSocioSchema.parse({ ...base, email: 'no-es-email' })).toThrow();
  });
});

describe('actualizarSocioSchema', () => {
  it('acepta un PATCH parcial', () => {
    expect(actualizarSocioSchema.parse({ nombre: 'Juan Editado' }).nombre).toBe('Juan Editado');
  });

  it('rechaza un PATCH vacío', () => {
    expect(() => actualizarSocioSchema.parse({})).toThrow();
  });

  it('NO expone activo como editable (server-owned)', () => {
    const r = actualizarSocioSchema.parse({ nombre: 'Juan Editado', activo: true } as object);
    expect(r).not.toHaveProperty('activo');
  });
});

describe('campos nuevos del socio (fechas, sexo cerrado y dirección)', () => {
  const base = { rut: '17682512K', nombre: 'Juan Pérez', anio: 2026 };

  it('acepta solo el catálogo Hombre/Mujer/Indefinido', () => {
    expect(sexoSocioSchema.parse('HOMBRE')).toBe('HOMBRE');
    expect(sexoSocioSchema.parse('MUJER')).toBe('MUJER');
    expect(sexoSocioSchema.parse('INDEFINIDO')).toBe('INDEFINIDO');
    expect(() => sexoSocioSchema.parse('OTRO')).toThrow();
    expect(() => sexoSocioSchema.parse('F')).toThrow();
  });

  it('acepta un sexo vacío en el alta y lo normaliza a sin dato', () => {
    const r = crearSocioSchema.parse({ ...base, sexo: '' });
    expect(r.sexo).toBeUndefined();
  });

  it('acepta fechas reales y rechaza fechas imposibles', () => {
    expect(fechaNacimientoSchema.parse('1990-03-15')).toBe('1990-03-15');
    expect(fechaIngresoSchema.parse('2021-03-01')).toBe('2021-03-01');
    expect(() => fechaNacimientoSchema.parse('1990-02-31')).toThrow();
    expect(() => fechaNacimientoSchema.parse('15-03-1990')).toThrow();
  });

  it('rechaza fechas futuras de nacimiento e ingreso', () => {
    expect(() => fechaNacimientoSchema.parse('2999-01-01')).toThrow();
    expect(() => fechaIngresoSchema.parse('2999-01-01')).toThrow();
  });

  it('guarda fecha de nacimiento, fecha de ingreso y dirección en el alta', () => {
    const r = crearSocioSchema.parse({
      ...base,
      fechaNacimiento: '1990-03-15',
      fechaIngreso: '2021-03-01',
      direccion: '  Av. Juan Mackenna 1234, Osorno  ',
    });
    expect(r.fechaNacimiento).toBe('1990-03-15');
    expect(r.fechaIngreso).toBe('2021-03-01');
    expect(r.direccion).toBe('Av. Juan Mackenna 1234, Osorno');
  });

  it('en el PATCH, vaciar un campo lo deja en null (borrado explícito)', () => {
    const r = actualizarSocioSchema.parse({ sexo: '', fechaNacimiento: '', direccion: '' });
    expect(r.sexo).toBeNull();
    expect(r.fechaNacimiento).toBeNull();
    expect(r.direccion).toBeNull();
  });

  it('rechaza una dirección demasiado larga', () => {
    expect(() => crearSocioSchema.parse({ ...base, direccion: 'x'.repeat(256) })).toThrow();
  });
});

describe('listarSociosQuerySchema', () => {
  it('aplica defaults de paginación', () => {
    const r = listarSociosQuerySchema.parse({});
    expect(r.pagina).toBe(1);
    expect(r.porPagina).toBe(25);
  });

  it('coerces pagina/porPagina de string a número', () => {
    const r = listarSociosQuerySchema.parse({ pagina: '2', porPagina: '10' });
    expect(r.pagina).toBe(2);
    expect(r.porPagina).toBe(10);
  });

  it('convierte activo "1"/"0" a boolean', () => {
    expect(listarSociosQuerySchema.parse({ activo: '1' }).activo).toBe(true);
    expect(listarSociosQuerySchema.parse({ activo: '0' }).activo).toBe(false);
    expect(listarSociosQuerySchema.parse({}).activo).toBeUndefined();
  });
});

describe('montoClpSchema', () => {
  it('acepta enteros no negativos y rechaza decimales/negativos', () => {
    expect(montoClpSchema.parse(0)).toBe(0);
    expect(montoClpSchema.parse(15000)).toBe(15000);
    expect(() => montoClpSchema.parse(15000.5)).toThrow();
    expect(() => montoClpSchema.parse(-1)).toThrow();
  });
});

describe('periodoSchema y crearPeriodoCuotaSchema (M2)', () => {
  it('acepta un período AAAA-MM válido', () => {
    expect(periodoSchema.parse('2026-11')).toBe('2026-11');
  });

  it('rechaza meses inválidos (AC6)', () => {
    expect(() => periodoSchema.parse('2026-13')).toThrow();
    expect(() => periodoSchema.parse('2026-00')).toThrow();
    expect(() => periodoSchema.parse('202611')).toThrow();
    expect(() => periodoSchema.parse('nov-2026')).toThrow();
  });

  it('acepta un período de cuota con día de vencimiento', () => {
    const r = crearPeriodoCuotaSchema.parse({ periodo: '2026-11', diaVencimiento: 10 });
    expect(r.periodo).toBe('2026-11');
    expect(r.diaVencimiento).toBe(10);
  });

  it('rechaza día de vencimiento fuera de rango', () => {
    expect(() => diaVencimientoSchema.parse(0)).toThrow();
    expect(() => diaVencimientoSchema.parse(32)).toThrow();
    expect(() => diaVencimientoSchema.parse(10.5)).toThrow();
  });
});
